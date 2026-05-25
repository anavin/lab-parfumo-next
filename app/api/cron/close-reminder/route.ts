/**
 * Close reminder cron — แจ้งเตือน creator เมื่อ PO รับของแล้วเกิน 1 วันยังไม่ปิด
 *
 * Schedule: 9:00 AM ICT ทุกวัน (vercel.json crons)
 * Filter: status ใน {"รับของแล้ว", "มีปัญหา"} + received_date ≥ 1 วันที่แล้ว
 *
 * Security: Bearer Authorization header (CRON_SECRET)
 */
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendPoUpdateEmail, sendAdminAlertsEmail, type AdminAlertItem } from "@/lib/email";
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
  type PoItem,
  type PurchaseOrder,
} from "@/lib/types/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn(
      "[cron/close-reminder] CRON_SECRET not set — rejecting all requests for safety.",
    );
    return false;
  }
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();

  // === Daily maintenance: refresh expired lots status ===
  // (F2 audit — trigger จับเฉพาะ UPDATE → ต้อง periodic refresh ของ lot ที่นิ่ง)
  // Lots ที่ expiry_date เลย today + ยัง status='active' → flip เป็น 'expired'
  let lotsExpiredCount = 0;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await sb
      .from("lots" as never)
      .update({ status: "expired" } as never, { count: "exact" })
      .eq("status", "active")
      .not("expiry_date", "is", null)
      .lt("expiry_date", today);
    lotsExpiredCount = count ?? 0;
    if (lotsExpiredCount > 0) {
      console.log(`[cron/close-reminder] flipped ${lotsExpiredCount} lots to 'expired'`);
    }
  } catch (e) {
    console.warn("[cron/close-reminder] lot expiry refresh failed:", e);
  }

  // === Close reminder ===
  // PO ที่ต้องเตือน:
  //   1) status ∈ {"รับของแล้ว", "มีปัญหา"}
  //   2) received_date <= today - 1 day
  //   3) last_close_reminder_sent_at IS NULL หรือ <= now() - 3 days (throttle)
  //      → กัน spam: ส่งทุก 3 วันสูงสุด (PO ค้าง 30 วัน → 10 emails ไม่ใช่ 30)
  const cutoffDate = new Date(Date.now() - 86_400_000) // 24 ชม. ที่แล้ว
    .toISOString()
    .slice(0, 10);
  const reminderCutoff = new Date(Date.now() - 3 * 86_400_000).toISOString();

  const { data: posRaw } = await sb
    .from("purchase_orders")
    .select("*")
    .in("status", ["รับของแล้ว", "มีปัญหา"])
    .lte("received_date", cutoffDate)
    .or(`last_close_reminder_sent_at.is.null,last_close_reminder_sent_at.lte.${reminderCutoff}`);

  const pos = (posRaw ?? []) as PurchaseOrder[];

  if (pos.length === 0) {
    return NextResponse.json({
      ok: true,
      total: 0,
      sent: 0,
      skipped: 0,
      message: "ไม่มี PO ที่ต้องเตือน",
    });
  }

  // ดึง creators ทั้งหมดในชุดเดียว
  const creatorIds = Array.from(
    new Set(pos.map((p) => p.created_by).filter((x): x is string => !!x)),
  );

  if (creatorIds.length === 0) {
    return NextResponse.json({
      ok: true,
      total: pos.length,
      sent: 0,
      skipped: pos.length,
      message: "ไม่มี creator (created_by null)",
    });
  }

  const { data: usersRaw } = await sb
    .from("users")
    .select("id, full_name, email, notification_prefs, is_active");
  type UserRow = {
    id: string;
    full_name: string;
    email: string | null;
    notification_prefs: NotificationPrefs | null;
    is_active: boolean;
  };
  const userMap = new Map<string, UserRow>();
  for (const u of ((usersRaw ?? []) as UserRow[])) {
    if (u.is_active) userMap.set(u.id, u);
  }

  // วนส่งทุก PO (best-effort — parallel)
  const today = new Date();
  const results = await Promise.allSettled(
    pos.map(async (po) => {
      const skip = (reason: string) => ({
        po: po.po_number,
        status: "skipped" as const,
        reason,
      });

      if (!po.created_by) return skip("no created_by");
      const creator = userMap.get(po.created_by);
      if (!creator) return skip("creator not found / inactive");
      if (!creator.email) return skip("creator has no email");

      const pref = creator.notification_prefs?.email_po_status_change
        ?? DEFAULT_NOTIFICATION_PREFS.email_po_status_change;
      if (!pref) return skip("creator opted out");

      // คำนวณจำนวนวันที่ผ่านไปจาก received_date
      let daysSince = 1;
      if (po.received_date) {
        const recv = new Date(po.received_date + "T00:00:00.000Z");
        const ms = today.getTime() - recv.getTime();
        daysSince = Math.max(1, Math.floor(ms / 86_400_000));
      }

      const r = await sendPoUpdateEmail({
        to: creator.email,
        recipientName: creator.full_name,
        poId: po.id,
        poNumber: po.po_number,
        kind: "close_reminder",
        by: "ระบบ",
        daysSinceReceived: daysSince,
      });
      if (!r.ok) {
        return {
          po: po.po_number,
          status: "failed" as const,
          error: r.error ?? "unknown",
          errorKind: r.errorKind,
        };
      }
      // Mark sent — throttle ครั้งต่อไปอีก 3 วัน
      await sb
        .from("purchase_orders")
        .update({ last_close_reminder_sent_at: new Date().toISOString() })
        .eq("id", po.id);
      return { po: po.po_number, status: "sent" as const, daysSince };
    }),
  );

  // นับสรุป
  const sent: string[] = [];
  const skipped: Array<{ po: string; reason: string }> = [];
  const failed: Array<{ po: string; error: string }> = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      const v = r.value;
      if (v.status === "sent") sent.push(v.po);
      else if (v.status === "skipped") skipped.push({ po: v.po, reason: v.reason });
      else if (v.status === "failed") failed.push({ po: v.po, error: v.error });
    }
  }

  console.log(
    `[cron/close-reminder] total=${pos.length} sent=${sent.length} ` +
    `skipped=${skipped.length} failed=${failed.length}`,
  );

  // ============================================================
  // Admin daily alerts — แจ้ง admin/supervisor ทุกวัน
  // ============================================================
  // 1) PO รอจัดซื้อดำเนินการ ค้าง ≥ 1 วัน (ยังไม่สั่งซื้อ)
  // 2) PO มีปัญหา ค้าง ≥ 1 วัน (ยังไม่แก้)
  // รวมเป็น 1 อีเมล/วัน/admin — gate ด้วย email_daily_digest pref
  let adminAlertsResult: {
    pendingCount: number;
    issueCount: number;
    recipients: number;
    sent: number;
    failed: number;
  } = { pendingCount: 0, issueCount: 0, recipients: 0, sent: 0, failed: 0 };

  try {
    // อายุ ≥ 1 วัน → created_at <= (now - 1 day)
    // ใช้ updated_at สำหรับ issues (เผื่อ status เพิ่งเปลี่ยนเป็น "มีปัญหา")
    const oneDayAgoIso = new Date(Date.now() - 86_400_000).toISOString();

    // (1) Pending: รอจัดซื้อ + อายุ ≥ 1 วัน
    const { data: pendingRaw } = await sb
      .from("purchase_orders")
      .select("id, po_number, status, items, created_by, created_by_name, created_at")
      .eq("status", "รอจัดซื้อดำเนินการ")
      .lte("created_at", oneDayAgoIso)
      .order("created_at", { ascending: true })
      .limit(200);

    // (2) Issues: มีปัญหา + อายุ ≥ 1 วันนับจาก updated_at
    const { data: issuesRaw } = await sb
      .from("purchase_orders")
      .select("id, po_number, status, items, created_by, created_by_name, created_at, updated_at")
      .eq("status", "มีปัญหา")
      .lte("updated_at", oneDayAgoIso)
      .order("updated_at", { ascending: true })
      .limit(200);

    type AlertPoRow = Pick<
      PurchaseOrder,
      "id" | "po_number" | "items" | "created_by_name" | "created_at"
    > & { updated_at?: string | null };

    const pendingPos = (pendingRaw ?? []) as AlertPoRow[];
    const issuePos = (issuesRaw ?? []) as AlertPoRow[];

    // ดึงสาเหตุ "มีปัญหา" จาก po_activities (action='received' ล่าสุด)
    // → activity.description มีรายละเอียดของปัญหาที่บันทึกตอนรับของ
    const issueReasonMap = new Map<string, string>();
    if (issuePos.length > 0) {
      try {
        const issueIds = issuePos.map((p) => p.id);
        const { data: activities } = await sb
          .from("po_activities" as never)
          .select("po_id, description, created_at, action")
          .in("po_id", issueIds)
          .eq("action", "received")
          .order("created_at", { ascending: false });
        type ActivityRow = {
          po_id: string;
          description: string | null;
          created_at: string;
          action: string;
        };
        for (const a of (activities ?? []) as ActivityRow[]) {
          // ใช้ activity ล่าสุดของแต่ละ PO
          if (!issueReasonMap.has(a.po_id) && a.description) {
            // strip ส่วน "รับของ #N | สภาพ: X | ..." — เอาเฉพาะส่วนหลัง |
            const parts = a.description.split("|").map((s) => s.trim());
            const reason = parts.slice(1).join(" • ") || a.description;
            issueReasonMap.set(a.po_id, reason.slice(0, 120));
          }
        }
      } catch (e) {
        console.warn("[cron/close-reminder] failed to fetch issue reasons:", e);
      }
    }

    const toAlertItem = (
      p: AlertPoRow,
      ageRefIso: string | null,
      reason?: string | null,
    ): AdminAlertItem => {
      const ref = ageRefIso ? new Date(ageRefIso).getTime() : Date.now();
      const ageDays = Math.max(
        1,
        Math.floor((Date.now() - ref) / 86_400_000),
      );
      const items = (p.items ?? []) as PoItem[];
      const totalQty = items.reduce((s, it) => s + (it.qty ?? 0), 0);
      return {
        poId: p.id,
        poNumber: p.po_number,
        createdByName: p.created_by_name ?? null,
        ageDays,
        itemCount: items.length,
        totalQty,
        reason: reason ?? undefined,
      };
    };

    const pendingItems: AdminAlertItem[] = pendingPos.map((p) =>
      toAlertItem(p, p.created_at),
    );
    const issueItems: AdminAlertItem[] = issuePos.map((p) =>
      toAlertItem(p, p.updated_at ?? p.created_at, issueReasonMap.get(p.id) ?? null),
    );

    adminAlertsResult.pendingCount = pendingItems.length;
    adminAlertsResult.issueCount = issueItems.length;

    if (pendingItems.length + issueItems.length > 0) {
      // ดึง admin/supervisor + กรอง pref
      const { data: adminsRaw } = await sb
        .from("users")
        .select("full_name, email, role, is_active, notification_prefs")
        .in("role", ["admin", "supervisor"])
        .eq("is_active", true)
        .not("email", "is", null);

      type AdminRow = {
        full_name: string;
        email: string | null;
        role: string;
        is_active: boolean;
        notification_prefs: NotificationPrefs | null;
      };
      const admins = ((adminsRaw ?? []) as AdminRow[]).filter((a) => {
        if (!a.email) return false;
        const pref =
          a.notification_prefs?.email_daily_digest ??
          DEFAULT_NOTIFICATION_PREFS.email_daily_digest;
        return pref;
      });

      adminAlertsResult.recipients = admins.length;

      // ดึงชื่อบริษัท (best-effort)
      let companyName = "Lab Parfumo";
      try {
        const { data: company } = await sb
          .from("company_settings" as never)
          .select("name, name_th")
          .eq("id", 1)
          .maybeSingle();
        const c = company as { name?: string; name_th?: string } | null;
        companyName = c?.name_th || c?.name || companyName;
      } catch {
        // ignore
      }

      const dateStr = new Date(
        Date.now() + 7 * 3600_000,
      ).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const alertResults = await Promise.allSettled(
        admins.map((a) =>
          sendAdminAlertsEmail({
            to: a.email as string,
            recipientName: a.full_name,
            pending: pendingItems,
            issues: issueItems,
            companyName,
            date: dateStr,
          }),
        ),
      );

      for (const r of alertResults) {
        if (r.status === "fulfilled" && r.value.ok) adminAlertsResult.sent++;
        else adminAlertsResult.failed++;
      }

      console.log(
        `[cron/close-reminder] admin alerts: pending=${pendingItems.length} ` +
          `issues=${issueItems.length} recipients=${admins.length} ` +
          `sent=${adminAlertsResult.sent} failed=${adminAlertsResult.failed}`,
      );
    } else {
      console.log("[cron/close-reminder] admin alerts: no pending/issue POs");
    }
  } catch (e) {
    console.error("[cron/close-reminder] admin alerts failed:", e);
  }

  return NextResponse.json({
    ok: true,
    total: pos.length,
    sent: sent.length,
    skipped: skipped.length,
    failed: failed.length,
    lotsExpired: lotsExpiredCount,
    adminAlerts: adminAlertsResult,
    detail: { sent, skipped, failed },
  });
}
