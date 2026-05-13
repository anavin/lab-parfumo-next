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
import { sendPoUpdateEmail } from "@/lib/email";
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
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

  return NextResponse.json({
    ok: true,
    total: pos.length,
    sent: sent.length,
    skipped: skipped.length,
    failed: failed.length,
    detail: { sent, skipped, failed },
  });
}
