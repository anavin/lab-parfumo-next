"use server";

/**
 * PO Server Actions — close, cancel, clone, comment, status update
 *
 * ทุก action:
 * 1. ตรวจ session (current user)
 * 2. ตรวจสิทธิ์ (ตาม role + เจ้าของ)
 * 3. ทำงานกับ DB
 * 4. log_activity
 * 5. revalidatePath เพื่อ refresh UI
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { suggestEquipmentFromPo } from "@/lib/db/equipment";
import type {
  PoStatus, PoItem, PurchaseOrder, PoAttachment,
  NotificationPrefs,
} from "@/lib/types/db";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/types/db";
import { createPoSchema, cancelPoSchema, formatZodError } from "./schemas";

interface ActionResult {
  ok: boolean;
  error?: string;
  poId?: string;
  poNumber?: string;
}

// ==================================================================
// Activity log + notifications (helpers)
// ==================================================================
async function logActivity(
  poId: string, userName: string, userRole: string,
  action: string, description: string,
) {
  const sb = getSupabaseAdmin();
  await sb.from("po_activities" as never).insert({
    po_id: poId, user_name: userName, user_role: userRole,
    action, description,
  } as never);
}

/**
 * Notification kind → maps to user pref key (Phase B)
 * - po_status_change: สถานะ PO เปลี่ยน (สั่งซื้อ/ขนส่ง/รับของ/เสร็จ)
 * - po_cancelled:     PO ถูกยกเลิก
 * - new_po:           มี PO ใหม่ (notify privileged)
 */
type NotifyKind = "po_status_change" | "po_cancelled" | "new_po";

function isAllowed(prefs: NotificationPrefs | null | undefined, kind: NotifyKind): boolean {
  const p = prefs ?? DEFAULT_NOTIFICATION_PREFS;
  switch (kind) {
    case "po_status_change": return p.inapp_po_status_change;
    case "po_cancelled":     return p.inapp_po_cancelled;
    case "new_po":           return p.inapp_new_po;
  }
}

/**
 * Email context — pass มาจาก callsite เพื่อให้ notifyUser ส่ง email ได้
 * ถ้าไม่ส่ง emailContext → ส่งแต่ in-app noti
 */
interface EmailContext {
  poNumber: string;
  emailKind: "ordered" | "shipping" | "completed" | "cancelled" | "issue";
  by: string;
  trackingNumber?: string;
  reason?: string;
  supplierName?: string;
  expectedDate?: string;
}

/**
 * แจ้งเตือน user ที่มีสิทธิ์ระดับสูง (admin + supervisor)
 * - in-app: ตาม pref `inapp_*`
 * - email: เฉพาะ kind="new_po" + pref `email_new_po` (default true)
 */
async function notifyAdmins(
  poId: string, title: string, message: string,
  kind: NotifyKind = "new_po",
  emailContext?: { poNumber: string; by: string; itemCount?: number },
) {
  const sb = getSupabaseAdmin();
  const { data: privileged } = await sb
    .from("users")
    .select("id, email, full_name, notification_prefs")
    .in("role", ["admin", "supervisor"])
    .eq("is_active", true);
  if (!privileged?.length) return;

  type Row = {
    id: string;
    email: string | null;
    full_name: string;
    notification_prefs: NotificationPrefs | null;
  };
  const rows = privileged as Row[];

  // 1) In-app
  const inappRecipients = rows.filter((a) => isAllowed(a.notification_prefs, kind));
  if (inappRecipients.length) {
    await sb.from("notifications").insert(
      inappRecipients.map((a) => ({ user_id: a.id, po_id: poId, title, message })),
    );
  }

  // 2) Email — เฉพาะ "new_po" เท่านั้น (admin ไม่รับ email status-change)
  if (kind === "new_po" && emailContext) {
    const adminWithoutEmail = rows.filter((a) => !a.email).length;
    const adminOptedOut = rows.filter((a) => {
      if (!a.email) return false;
      const pref = a.notification_prefs?.email_new_po ?? DEFAULT_NOTIFICATION_PREFS.email_new_po;
      return !pref;
    }).length;
    const emailRecipients = rows.filter((a) => {
      if (!a.email) return false;
      const pref = a.notification_prefs?.email_new_po ?? DEFAULT_NOTIFICATION_PREFS.email_new_po;
      return pref;
    });
    console.log(
      `[email new_po] PO=${emailContext.poNumber} • totalAdmins=${rows.length} ` +
      `• willEmail=${emailRecipients.length} ` +
      `• skipped(no email)=${adminWithoutEmail} ` +
      `• skipped(opted-out)=${adminOptedOut}`,
    );
    if (emailRecipients.length) {
      try {
        const { sendPoUpdateEmail } = await import("@/lib/email");
        const results = await Promise.allSettled(
          emailRecipients.map((a) =>
            sendPoUpdateEmail({
              to: a.email!,
              recipientName: a.full_name,
              poId,
              poNumber: emailContext.poNumber,
              kind: "new_for_admin",
              by: emailContext.by,
              itemCount: emailContext.itemCount,
            }),
          ),
        );
        // Log each result individually so we can see SMTP errors
        results.forEach((r, i) => {
          const recipient = emailRecipients[i].email;
          if (r.status === "rejected") {
            console.error(`[email new_po → ${recipient}] rejected:`, r.reason);
          } else if (!r.value.ok) {
            console.error(
              `[email new_po → ${recipient}] sendEmail returned ok=false:`,
              { errorKind: r.value.errorKind, error: r.value.error, detail: r.value.errorDetail },
            );
          } else {
            console.log(`[email new_po → ${recipient}] sent ✓`);
          }
        });
      } catch (e) {
        console.error("[email new_po admins] threw:", e);
      }
    }
  }
}

/**
 * แจ้งเตือน user เดี่ยว (ส่วนใหญ่คือ creator)
 * - in-app: ตาม pref `inapp_*`
 * - email: ถ้า emailContext ระบุ + pref `email_po_status_change` allow + มี email
 */
async function notifyUser(
  userId: string, poId: string, title: string, message: string,
  kind: NotifyKind = "po_status_change",
  emailContext?: EmailContext,
) {
  const sb = getSupabaseAdmin();
  const { data: u } = await sb
    .from("users")
    .select("notification_prefs, email, full_name")
    .eq("id", userId)
    .maybeSingle();
  const user = u as {
    notification_prefs: NotificationPrefs | null;
    email: string | null;
    full_name: string;
  } | null;
  const prefs = user?.notification_prefs ?? null;

  // 1) In-app
  if (isAllowed(prefs, kind)) {
    await sb.from("notifications").insert({
      user_id: userId, po_id: poId, title, message,
    });
  }

  // 2) Email — diagnostic logging
  if (!emailContext) {
    // ไม่ใช่ transition ที่จะส่ง email — skip silent
  } else if (!user) {
    console.warn(`[email po status] user not found: ${userId}`);
  } else if (!user.email) {
    console.warn(`[email po status] user has no email: ${userId} (${user.full_name})`);
  } else {
    const emailPref = prefs?.email_po_status_change ?? DEFAULT_NOTIFICATION_PREFS.email_po_status_change;
    if (!emailPref) {
      console.log(
        `[email po status → ${user.email}] skipped — user opted out (prefs=${JSON.stringify(prefs)})`,
      );
    } else {
      console.log(
        `[email po status] PO=${emailContext.poNumber} kind=${emailContext.emailKind} → ${user.email}`,
      );
      try {
        const { sendPoUpdateEmail } = await import("@/lib/email");
        const result = await sendPoUpdateEmail({
          to: user.email,
          recipientName: user.full_name,
          poId,
          poNumber: emailContext.poNumber,
          kind: emailContext.emailKind,
          by: emailContext.by,
          trackingNumber: emailContext.trackingNumber,
          reason: emailContext.reason,
          supplierName: emailContext.supplierName,
          expectedDate: emailContext.expectedDate,
        });
        if (!result.ok) {
          console.error(
            `[email po status → ${user.email}] sendEmail returned ok=false:`,
            { errorKind: result.errorKind, error: result.error, detail: result.errorDetail },
          );
        } else {
          console.log(`[email po status → ${user.email}] sent ✓`);
        }
      } catch (e) {
        console.error("[email po status] threw:", e);
      }
    }
  }
}

// ==================================================================
// Status updates: close, cancel, ship
// ==================================================================
async function _updateStatus(
  poId: string, newStatus: PoStatus, note: string, trackingNumber?: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };

  const sb = getSupabaseAdmin();
  const { data: po } = await sb
    .from("purchase_orders")
    .select("*")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };

  const update: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };
  if (trackingNumber !== undefined) update.tracking_number = trackingNumber;
  if (newStatus === "เสร็จสมบูรณ์" && !po.received_date) {
    update.received_date = new Date().toISOString().slice(0, 10);
  }

  const { error } = await sb.from("purchase_orders").update(update).eq("id", poId);
  if (error) return { ok: false, error: "บันทึกไม่สำเร็จ" };

  await logActivity(
    poId, user.full_name, user.role, "status_changed",
    `${po.status} → ${newStatus}${note ? ` | ${note}` : ""}`,
  );

  // Notifications + email (5 transitions ส่ง email หา creator ตาม pref)
  try {
    if (newStatus === "กำลังขนส่ง" && po.created_by) {
      const tk = trackingNumber ? ` • Tracking: ${trackingNumber}` : "";
      await notifyUser(
        po.created_by, poId,
        `🚚 ${po.po_number} กำลังขนส่ง`,
        `Supplier ส่งของแล้ว${tk} — เตรียมรับของได้`,
        "po_status_change",
        {
          poNumber: po.po_number,
          emailKind: "shipping",
          by: user.full_name,
          trackingNumber: trackingNumber || undefined,
        },
      );
    } else if (newStatus === "เสร็จสมบูรณ์" && po.created_by) {
      await notifyUser(
        po.created_by, poId,
        `🎉 ${po.po_number} เสร็จสมบูรณ์`,
        "ปิดงานเรียบร้อย",
        "po_status_change",
        {
          poNumber: po.po_number,
          emailKind: "completed",
          by: user.full_name,
        },
      );
    } else if (newStatus === "ยกเลิก") {
      if (po.created_by) {
        await notifyUser(
          po.created_by, poId,
          `❌ ${po.po_number} ถูกยกเลิก`,
          `โดย ${user.full_name}${note ? ` • ${note}` : ""}`,
          "po_cancelled",
          {
            poNumber: po.po_number,
            emailKind: "cancelled",
            by: user.full_name,
            reason: note || undefined,
          },
        );
      }
      // admin in-app เดิม (ไม่ส่ง email — admin ไม่รับ status-change emails)
      await notifyAdmins(
        poId, `❌ ${po.po_number} ถูกยกเลิก`, `โดย ${user.full_name}`,
        "po_cancelled",
      );
    }
  } catch {
    // notification ล้มเหลวไม่ควร block action
  }

  revalidatePath(`/po/${poId}`);
  revalidatePath("/po");
  revalidatePath("/dashboard");
  return { ok: true, poId, poNumber: po.po_number };
}

// ==================================================================
// Close PO — เฉพาะ status ที่รับของแล้ว
// ==================================================================
const CLOSEABLE_STATUSES: PoStatus[] = ["รับของแล้ว", "มีปัญหา"];

export async function closePoAction(poId: string): Promise<ActionResult> {
  // Workflow gate: ปิดงานได้เฉพาะหลังจากรับของแล้วเท่านั้น
  // ก่อนหน้า: ปิดได้จากทุก state (แม้ draft) → audit "BROKEN"
  const sb = getSupabaseAdmin();
  const { data: po } = await sb
    .from("purchase_orders")
    .select("status")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };
  if (!CLOSEABLE_STATUSES.includes(po.status as PoStatus)) {
    return {
      ok: false,
      error: `ปิดงานไม่ได้ — สถานะปัจจุบัน "${po.status}" • ต้องเป็น "รับของแล้ว" หรือ "มีปัญหา" ก่อน`,
    };
  }
  return _updateStatus(poId, "เสร็จสมบูรณ์", "ปิดงาน");
}

// ==================================================================
// Cancel PO (with reason) — ห้ามยกเลิก terminal state + stock rollback
// ==================================================================
const TERMINAL_STATUSES: PoStatus[] = ["เสร็จสมบูรณ์", "ยกเลิก"];
// สถานะที่อาจมี stock ถูก add ไปแล้ว — ยกเลิกแล้วต้อง rollback
const RECEIVED_STATUSES: PoStatus[] = ["รับของแล้ว", "มีปัญหา"];

interface DeliveryItemRow {
  equipment_id: string | null;
  qty_received: number;
}

/**
 * ถอย stock ทั้งหมดที่เคยรับมาจาก deliveries ของ PO นี้
 * ใช้ select+update (non-atomic) — ในอนาคตจะใช้ atomic RPC เมื่อรัน migration
 * ป้องกันค่าติดลบด้วย Math.max(0, ...)
 */
async function rollbackPoStock(poId: string): Promise<{
  totalUnits: number;
  itemsAffected: number;
}> {
  const sb = getSupabaseAdmin();
  const { data: deliveries } = await sb
    .from("po_deliveries" as never)
    .select("items_received")
    .eq("po_id", poId);

  if (!deliveries?.length) return { totalUnits: 0, itemsAffected: 0 };

  // รวมจำนวนต่อ equipment_id (อาจมีหลาย delivery ต่อ equipment)
  const totals = new Map<string, number>();
  for (const d of deliveries as Array<{ items_received: DeliveryItemRow[] }>) {
    for (const it of d.items_received ?? []) {
      if (!it.equipment_id) continue;
      const qty = Math.floor(it.qty_received ?? 0);
      if (qty <= 0) continue;
      totals.set(it.equipment_id, (totals.get(it.equipment_id) ?? 0) + qty);
    }
  }

  let totalUnits = 0;
  let itemsAffected = 0;
  for (const [eqId, qty] of totals) {
    // Atomic decrement ผ่าน RPC (GREATEST(0, ...) กันค่าติดลบ)
    let useRpc = true;
    try {
      const { error: rpcErr } = await sb.rpc("increment_equipment_stock", {
        p_id: eqId, p_qty: -qty,
      });
      if (rpcErr) useRpc = false;
    } catch { useRpc = false; }

    if (!useRpc) {
      console.warn(
        "[rollback] increment_equipment_stock RPC unavailable — using fallback. " +
        "Please run migration 202604_workflow_atomic.sql.",
      );
      const { data: eq } = await sb
        .from("equipment")
        .select("stock")
        .eq("id", eqId)
        .maybeSingle();
      const cur = (eq?.stock ?? 0) as number;
      await sb.from("equipment")
        .update({ stock: Math.max(0, cur - qty) })
        .eq("id", eqId);
    }
    totalUnits += qty;
    itemsAffected++;
  }

  return { totalUnits, itemsAffected };
}

export async function cancelPoAction(
  poId: string, reason: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };

  const parsed = cancelPoSchema.safeParse({ poId, reason });
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }

  const sb = getSupabaseAdmin();
  const { data: po } = await sb
    .from("purchase_orders")
    .select("created_by, status")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };

  // Permission: requester ยกเลิกได้เฉพาะของตัวเอง
  if (user.role === "requester" && po.created_by !== user.id) {
    return { ok: false, error: "ไม่มีสิทธิ์ยกเลิก PO นี้" };
  }

  // Status gate: ห้ามยกเลิก PO ที่อยู่ใน terminal state
  if (TERMINAL_STATUSES.includes(po.status as PoStatus)) {
    return {
      ok: false,
      error: `ยกเลิกไม่ได้ — สถานะ "${po.status}" เป็น terminal state แล้ว`,
    };
  }

  // Stock rollback: ถ้าเคยรับของไปแล้ว → ถอย stock ออก
  let rollbackNote = "";
  if (RECEIVED_STATUSES.includes(po.status as PoStatus)) {
    try {
      const rb = await rollbackPoStock(poId);
      if (rb.totalUnits > 0) {
        rollbackNote = ` | ถอย stock ${rb.totalUnits} ชิ้น (${rb.itemsAffected} รายการ)`;
      }
    } catch (e) {
      // ถ้า rollback fail — log แต่ไม่ block การ cancel
      // (สำคัญกว่าคือ PO เปลี่ยนเป็น cancelled — stock fix manual ทีหลังได้)
      console.error("[cancel] stock rollback failed:", e);
      rollbackNote = " | ⚠️ rollback stock ไม่สำเร็จ — ตรวจ manual";
    }
  }

  return _updateStatus(poId, "ยกเลิก", `${reason}${rollbackNote}`);
}

// ==================================================================
// Ship (admin) — update tracking + status to กำลังขนส่ง
// ==================================================================
export async function shipPoAction(
  poId: string, trackingNumber: string, note: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  return _updateStatus(poId, "กำลังขนส่ง", note, trackingNumber);
}

// ==================================================================
// Clone PO — copy items → create new draft PO
// ==================================================================
export async function clonePoAction(sourcePoId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sb = getSupabaseAdmin();
  const { data: source } = await sb
    .from("purchase_orders")
    .select("*")
    .eq("id", sourcePoId)
    .maybeSingle();
  if (!source) {
    redirect("/po");
  }

  // สร้าง items ใหม่ (clone โดยตัด price/subtotal ออก)
  const sourcePo = source as PurchaseOrder;
  const newItems: PoItem[] = (sourcePo.items ?? []).map((it) => ({
    equipment_id: it.equipment_id,
    name: it.name,
    qty: it.qty,
    unit: it.unit,
    notes: it.notes,
    image_urls: it.image_urls,
  }));

  const newPoNumber = await generatePoNumber();
  const { data: newPo } = await sb
    .from("purchase_orders")
    .insert({
      po_number: newPoNumber,
      items: newItems,
      purpose: "",
      notes: `[คัดลอกจาก ${sourcePo.po_number}] ${sourcePo.notes ?? ""}`.trim(),
      status: "รอจัดซื้อดำเนินการ",
      created_by: user.id,
      created_by_name: user.full_name,
    })
    .select()
    .maybeSingle();

  if (!newPo) {
    redirect("/po");
  }

  await logActivity(
    newPo!.id, user.full_name, user.role, "cloned",
    `คัดลอกจาก ${sourcePo.po_number}`,
  );
  revalidatePath("/po");
  revalidatePath("/dashboard");
  redirect(`/po/${newPo!.id}`);
}

// ==================================================================
// Add Comment
// ==================================================================
export async function addCommentAction(
  poId: string, message: string,
): Promise<ActionResult> {
  if (!message.trim()) {
    return { ok: false, error: "ข้อความว่าง — กรุณาพิมพ์ข้อความ" };
  }
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("po_comments" as never).insert({
    po_id: poId,
    user_name: user.full_name,
    user_role: user.role,
    message: message.trim(),
  } as never);
  if (error) return { ok: false, error: "บันทึก comment ไม่สำเร็จ" };

  await logActivity(
    poId, user.full_name, user.role, "commented",
    message.trim().slice(0, 100),
  );
  revalidatePath(`/po/${poId}`);
  return { ok: true, poId };
}

// ==================================================================
// PO Attachments — add / remove
// ==================================================================

export async function addPoAttachmentsAction(
  poId: string,
  newAttachments: PoAttachment[],
  category: "order" | "shipping" | "general" = "general",
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };
  if (!newAttachments.length) return { ok: false, error: "ไม่มีไฟล์" };

  const sb = getSupabaseAdmin();
  const { data: po } = await sb
    .from("purchase_orders")
    .select("attachment_urls, po_number")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };

  const existing: PoAttachment[] = (po.attachment_urls ?? []) as PoAttachment[];
  const enriched = newAttachments.map((a) => ({
    ...a,
    category,
    uploaded_by: user.full_name,
  }));
  const merged = [...existing, ...enriched];

  await sb
    .from("purchase_orders")
    .update({
      attachment_urls: merged,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);

  await logActivity(
    poId, user.full_name, user.role, "attached",
    `แนบไฟล์ ${newAttachments.length} ไฟล์`,
  );

  revalidatePath(`/po/${poId}`);
  return { ok: true, poId };
}

export async function removePoAttachmentAction(
  poId: string, attachmentUrl: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };

  const sb = getSupabaseAdmin();
  const { data: po } = await sb
    .from("purchase_orders")
    .select("attachment_urls")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };

  const existing: PoAttachment[] = (po.attachment_urls ?? []) as PoAttachment[];
  const removed = existing.find((a) => a.url === attachmentUrl);
  const newList = existing.filter((a) => a.url !== attachmentUrl);

  await sb
    .from("purchase_orders")
    .update({
      attachment_urls: newList,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);

  if (removed) {
    await logActivity(
      poId, user.full_name, user.role, "attachment_removed",
      `ลบไฟล์: ${removed.name}`,
    );
  }
  revalidatePath(`/po/${poId}`);
  return { ok: true, poId };
}

// ==================================================================
// PO number generator — ใช้ RPC ถ้ามี (atomic), fallback ถ้าไม่มี
//
// ⚠️ RPC คือ source of truth — Postgres `next_po_number()` atomic
// Fallback (read-modify-write) มี race condition:
//   user A read 5 → user B read 5 → ทั้งคู่ +1 = 6 → ออก PO ซ้ำ!
// แก้โดยใช้ MAX(po_number) บน table จริง (last-resort, ยังไม่ atomic
// แต่กันชน RPC fail ได้ปกติ + ตรวจซ้ำหลังสร้างแล้ว throw ถ้า dup)
// ==================================================================
export async function generatePoNumber(): Promise<string> {
  const sb = getSupabaseAdmin();
  const year = new Date().getFullYear();
  // Primary: RPC (atomic via Postgres function จาก migration_atomic_counter.sql)
  try {
    const { data, error } = await sb.rpc("next_po_number", { year_int: year });
    if (!error && data) return String(data);
  } catch {
    // fallthrough
  }

  // Fallback: read MAX(po_number) จาก table จริง (มี race condition แต่ดีกว่า counter row)
  const prefix = `PO-${year}-`;
  const { data: rows, error: maxErr } = await sb
    .from("purchase_orders")
    .select("po_number")
    .like("po_number", `${prefix}%`)
    .order("po_number", { ascending: false })
    .limit(1);
  if (maxErr) {
    throw new Error(`ไม่สามารถสร้างเลข PO: ${maxErr.message}`);
  }
  let next = 1;
  if (rows?.length) {
    const last = rows[0].po_number as string;
    const match = last.match(/PO-\d{4}-(\d+)/);
    if (match) next = parseInt(match[1], 10) + 1;
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
}

// ==================================================================
// Create PO
// ==================================================================
export async function createPoAction(
  items: PoItem[], notes: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };

  // Validate input
  const parsed = createPoSchema.safeParse({ items, notes });
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }

  const sb = getSupabaseAdmin();

  // Sanitize items
  const cleanItems: PoItem[] = items.map((it) => ({
    equipment_id: it.equipment_id ?? null,
    name: it.name,
    qty: Math.max(1, Math.floor(it.qty ?? 0)),
    unit: it.unit ?? "ชิ้น",
    unit_price: 0,
    subtotal: 0,
    notes: it.notes ?? "",
    image_urls: it.image_urls ?? [],
  }));

  // Retry on duplicate po_number — กัน race ตอน RPC fallback ใช้
  let newPo: { id: string; po_number: string } | null = null;
  let lastErr: { code?: string; message?: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const poNumber = await generatePoNumber();
    const { data, error } = await sb
      .from("purchase_orders")
      .insert({
        po_number: poNumber,
        items: cleanItems,
        purpose: "",
        notes,
        status: "รอจัดซื้อดำเนินการ",
        created_by: user.id,
        created_by_name: user.full_name,
      })
      .select()
      .maybeSingle();
    if (data) {
      newPo = data as { id: string; po_number: string };
      break;
    }
    lastErr = error ?? null;
    // 23505 = unique_violation — เลข PO ซ้ำ → ลอง gen ใหม่
    if (error?.code !== "23505") break;
  }
  if (!newPo) {
    return {
      ok: false,
      error: `สร้าง PO ไม่สำเร็จ — ${lastErr?.message ?? "ลองใหม่อีกครั้ง"}`,
    };
  }

  await logActivity(
    newPo.id, user.full_name, user.role, "created",
    `สร้าง PO มี ${items.length} รายการ`,
  );

  // Suggest pending equipment สำหรับ custom items
  let anyLinked = false;
  for (let i = 0; i < cleanItems.length; i++) {
    const it = cleanItems[i];
    if (!it.equipment_id && it.name) {
      const pending = await suggestEquipmentFromPo({
        name: it.name,
        unit: it.unit,
        notes: it.notes ?? "",
        imageUrls: it.image_urls ?? [],
        suggestedBy: user.id,
        suggestedByName: user.full_name,
        suggestedFromPo: newPo.id,
      });
      if (pending) {
        cleanItems[i].equipment_id = pending.id;
        anyLinked = true;
      }
    }
  }
  if (anyLinked) {
    await sb
      .from("purchase_orders")
      .update({ items: cleanItems })
      .eq("id", newPo.id);
  }

  // Notify admins (in-app + email — admin รับ email ตาม pref `email_new_po`)
  try {
    const nCustom = items.filter((it) => !it.equipment_id).length;
    const msg = `${newPo.po_number} • ${items.length} รายการ${
      nCustom > 0 ? ` (มี ${nCustom} รายการใหม่ที่รออนุมัติ)` : ""
    }`;
    await notifyAdmins(
      newPo.id, `📥 PO ใหม่จาก ${user.full_name}`, msg,
      "new_po",
      {
        poNumber: newPo.po_number,
        by: user.full_name,
        itemCount: items.length,
      },
    );
  } catch {
    // ok ถ้าแจ้งไม่ได้
  }

  revalidatePath("/po");
  revalidatePath("/dashboard");
  return { ok: true, poId: newPo.id, poNumber: newPo.po_number };
}

// ==================================================================
// Procurement: Admin → กรอก supplier + ราคา → status = สั่งซื้อแล้ว
// ==================================================================
export interface ProcurementInput {
  supplierName: string;
  supplierContact: string;
  itemPrices: Array<{ unit_price: number }>;  // ตรงตำแหน่งกับ po.items
  discount: number;
  shippingFee: number;
  vatRate: number;          // 0 หรือ 0.07
  expectedDate: string;     // YYYY-MM-DD
  procurementNotes: string;
  /** Set to true when admin acknowledged a budget warning */
  acknowledgeOverBudget?: boolean;
}

export interface ProcurementResult extends ActionResult {
  /** When set, server is asking for budget confirmation */
  budgetWarning?: {
    budgetName: string;
    budgetAmount: number;
    actualBefore: number;
    poTotal: number;
    actualAfter: number;
    overBy: number;
  };
}

export async function updateProcurementAction(
  poId: string, input: ProcurementInput,
): Promise<ProcurementResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  if (!input.supplierName.trim()) {
    return { ok: false, error: "กรุณากรอกชื่อ supplier" };
  }
  if (!input.expectedDate) {
    return { ok: false, error: "กรุณาเลือกวันที่คาดว่าจะได้รับ" };
  }

  const sb = getSupabaseAdmin();
  const { data: po } = await sb
    .from("purchase_orders")
    .select("*")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };

  const items = (po.items ?? []) as PoItem[];
  if (input.itemPrices.length !== items.length) {
    return { ok: false, error: "จำนวน items ไม่ตรงกับฟอร์ม" };
  }

  // Build new items with prices
  const newItems = items.map((it, idx) => {
    const unitPrice = Math.max(0, input.itemPrices[idx]?.unit_price ?? 0);
    return {
      ...it,
      unit_price: unitPrice,
      subtotal: unitPrice * (it.qty ?? 0),
    };
  });

  const subtotal = newItems.reduce((s, it) => s + (it.subtotal ?? 0), 0);
  const vat = subtotal * input.vatRate;
  const total = subtotal - input.discount + input.shippingFee + vat;

  // Budget check — warn if this PO pushes spending over any active budget
  if (!input.acknowledgeOverBudget) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    try {
      const { getBudgetStatusForMonth } = await import("@/lib/db/budget");
      const statuses = await getBudgetStatusForMonth(year, month);
      // Find any active budget that would go over after this PO
      for (const b of statuses) {
        // Skip category-specific budgets (would need category match)
        if (b.category) continue;
        const newActual = b.actual + total;
        if (newActual > b.amount && b.actual <= b.amount) {
          // Crossing the threshold
          return {
            ok: false,
            budgetWarning: {
              budgetName: b.period_type === "monthly"
                ? `งบเดือน ${month}/${year}`
                : b.period_type === "yearly"
                  ? `งบปี ${year}`
                  : `งบไตรมาส ${year}`,
              budgetAmount: b.amount,
              actualBefore: b.actual,
              poTotal: total,
              actualAfter: newActual,
              overBy: newActual - b.amount,
            },
          };
        }
      }
    } catch {
      // budget check ล้มเหลว — ปล่อยให้ทำงานต่อ (don't block)
    }
  }

  // ค้นหา supplier_id จาก name (case-insensitive) — link FK เพื่อ PO history
  // ถ้าไม่เจอ → supplier_id = null (admin ต้อง create supplier ใน /suppliers ก่อน)
  let supplierId: string | null = null;
  const supplierName = input.supplierName.trim();
  if (supplierName) {
    const { data: matched } = await sb
      .from("suppliers" as never)
      .select("id")
      .ilike("name", supplierName)
      .limit(1)
      .maybeSingle();
    supplierId = ((matched as { id: string } | null)?.id) ?? null;
  }

  const { error } = await sb
    .from("purchase_orders")
    .update({
      supplier_name: supplierName,
      supplier_contact: input.supplierContact.trim(),
      supplier_id: supplierId,
      items: newItems,
      subtotal,
      discount: input.discount,
      shipping_fee: input.shippingFee,
      vat,
      total,
      expected_date: input.expectedDate,
      ordered_date: new Date().toISOString().slice(0, 10),
      procurement_notes: input.procurementNotes.trim(),
      status: "สั่งซื้อแล้ว",
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);
  if (error) {
    console.error("[procurement] update failed:", error);
    return { ok: false, error: "บันทึกไม่สำเร็จ" };
  }

  // Update last_cost ของ equipment
  for (const it of newItems) {
    if (it.equipment_id && (it.unit_price ?? 0) > 0) {
      await sb
        .from("equipment")
        .update({ last_cost: it.unit_price })
        .eq("id", it.equipment_id);
    }
  }

  await logActivity(
    poId, user.full_name, user.role, "ordered",
    `สั่งกับ ${input.supplierName} | คาดได้ ${input.expectedDate}`,
  );

  if (po.created_by) {
    try {
      await notifyUser(
        po.created_by, poId,
        `✅ ${po.po_number} สั่งซื้อแล้ว`,
        `แอดมินสั่งกับ ${input.supplierName} • คาดว่าจะได้รับ ${input.expectedDate}`,
        "po_status_change",
        {
          poNumber: po.po_number,
          emailKind: "ordered",
          by: user.full_name,
          supplierName: input.supplierName,
          expectedDate: input.expectedDate,
        },
      );
    } catch { /* ok */ }
  }

  revalidatePath(`/po/${poId}`);
  revalidatePath("/po");
  revalidatePath("/dashboard");
  return { ok: true, poId, poNumber: po.po_number };
}

// ==================================================================
// Add Delivery (รับของ) — staff หรือ admin
// ==================================================================
export interface DeliveryItem {
  equipment_id: string | null;
  name: string;
  qty_ordered: number;
  qty_received: number;
  qty_damaged: number;
  notes?: string;
}

export interface DeliveryInput {
  itemsReceived: DeliveryItem[];
  overallCondition: string;     // ปกติ / มีของเสียหาย / ขาดจำนวน / ส่งผิด / อื่นๆ
  issueDescription: string;
  notes: string;
  imageUrls: string[];          // ที่อัปโหลดเสร็จแล้ว
}

export async function addDeliveryAction(
  poId: string, input: DeliveryInput,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };

  const sb = getSupabaseAdmin();
  const { data: po } = await sb
    .from("purchase_orders")
    .select("*")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };

  // Note: ทุก user (admin + staff) สามารถกดรับสินค้าได้บน PO ใดๆ ก็ได้
  // ผู้กดรับจะถูกบันทึกใน received_by_name ด้านล่าง

  // Workflow gate: รับของได้เฉพาะเมื่อสถานะเป็น "กำลังขนส่ง" เท่านั้น
  // (ต้องผ่านขั้น "สั่งซื้อแล้ว" → "กำลังขนส่ง" ก่อน admin อัปเดตขนส่ง
  //  จากนั้น ใครก็ได้ถึงจะกดรับของได้)
  if (po.status !== "กำลังขนส่ง") {
    const hint = po.status === "สั่งซื้อแล้ว"
      ? "รอแอดมินอัปเดตสถานะขนส่งก่อน"
      : `สถานะปัจจุบัน: ${po.status}`;
    return {
      ok: false,
      error: `ยังกดรับของไม่ได้ — ${hint}`,
    };
  }

  // หา delivery_no + insert แบบทนต่อ race condition
  // - พยายาม atomic ผ่าน RPC ก่อน (advisory lock + unique constraint)
  // - ถ้า RPC ไม่มี (migration ยังไม่รัน) → fallback select-max + retry
  let newNo = 0;
  let inserted = false;
  let insertedDeliveryId: string | null = null;  // Phase E: เก็บไว้ใช้สร้าง lot
  for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
    let candidateNo: number | null = null;
    // 1) ลองใช้ RPC (atomic — รัน migration แล้วจะ work)
    try {
      const { data: rpcData, error: rpcErr } = await sb.rpc(
        "next_po_delivery_no",
        { p_po_id: poId },
      );
      if (!rpcErr && typeof rpcData === "number") {
        candidateNo = rpcData;
      }
    } catch { /* ignore — fallback */ }

    // 2) Fallback: select-max (race-prone แต่ retry ใน loop)
    if (candidateNo === null) {
      const { data: existingDeliveries } = await sb
        .from("po_deliveries" as never)
        .select("delivery_no")
        .eq("po_id", poId);
      const maxNo = ((existingDeliveries ?? []) as Array<{ delivery_no: number }>)
        .reduce((m, d) => Math.max(m, d.delivery_no ?? 0), 0);
      candidateNo = maxNo + 1 + attempt; // bump ตาม attempt เพื่อ retry
    }

    const { data: insertedRow, error: deliveryErr } = await sb
      .from("po_deliveries" as never)
      .insert({
        po_id: poId,
        delivery_no: candidateNo,
        received_date: new Date().toISOString().slice(0, 10),
        received_by_name: user.full_name,
        items_received: input.itemsReceived,
        overall_condition: input.overallCondition,
        issue_description: input.issueDescription,
        notes: input.notes,
        image_urls: input.imageUrls,
      } as never)
      .select("id")
      .maybeSingle();
    if (!deliveryErr) {
      newNo = candidateNo;
      inserted = true;
      insertedDeliveryId = (insertedRow as { id: string } | null)?.id ?? null;
      break;
    }
    // unique_violation (Postgres 23505) — retry
    const code = (deliveryErr as { code?: string }).code;
    if (code === "23505") continue;
    console.error("[delivery] insert failed:", deliveryErr);
    return { ok: false, error: "บันทึกการรับของไม่สำเร็จ" };
  }
  if (!inserted) {
    return { ok: false, error: "บันทึกการรับของไม่สำเร็จ — ลองอีกครั้ง" };
  }

  // เพิ่ม stock — atomic RPC + fallback (เหมือน delivery_no)
  let customItemsCount = 0;
  let stockUpdatedCount = 0;
  for (const it of input.itemsReceived) {
    if (!it.equipment_id) {
      // custom item — บันทึกเพื่อ trace แต่ไม่กระทบ stock
      if (it.qty_received > 0) customItemsCount++;
      continue;
    }
    if (it.qty_received <= 0) continue;
    const qty = Math.floor(it.qty_received);

    let useRpc = true;
    try {
      const { error: rpcErr } = await sb.rpc("increment_equipment_stock", {
        p_id: it.equipment_id, p_qty: qty,
      });
      if (rpcErr) useRpc = false;
    } catch { useRpc = false; }

    if (!useRpc) {
      // Fallback non-atomic — log แจ้งให้ admin รัน migration
      console.warn(
        "[delivery] increment_equipment_stock RPC unavailable — using fallback. " +
        "Please run migration 202604_workflow_atomic.sql for race-safe stock updates.",
      );
      const { data: eq } = await sb
        .from("equipment")
        .select("stock")
        .eq("id", it.equipment_id)
        .maybeSingle();
      const cur = (eq?.stock ?? 0) as number;
      await sb
        .from("equipment")
        .update({ stock: cur + qty })
        .eq("id", it.equipment_id);
    }
    stockUpdatedCount++;
  }

  // Phase E: สร้าง lot อัตโนมัติ (best-effort — ไม่ block flow ถ้า lots table ยังไม่ migrate)
  if (insertedDeliveryId) {
    try {
      const { createLotsForDelivery } = await import("./lots");
      await createLotsForDelivery({
        poId,
        poNumber: po.po_number ?? "",
        poDeliveryId: insertedDeliveryId,
        supplierName: po.supplier_name ?? null,
        receivedByName: user.full_name,
        receivedDate: new Date().toISOString().slice(0, 10),
        items: input.itemsReceived.map((it) => ({
          equipment_id: it.equipment_id,
          name: it.name,
          qty_received: it.qty_received,
          unit: undefined, // อาจจะดึงจาก equipment.unit ทีหลัง
        })),
      });
    } catch (e) {
      console.warn("[lots] auto-create skipped:", e);
    }
  }

  // Update PO status + received_date
  const newStatus: PoStatus = input.overallCondition === "ปกติ" ? "รับของแล้ว" : "มีปัญหา";
  await sb
    .from("purchase_orders")
    .update({
      status: newStatus,
      received_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);

  // Activity log — บันทึก stock + custom items detail
  const stockNote = stockUpdatedCount > 0
    ? ` | อัปเดต stock ${stockUpdatedCount} รายการ` : "";
  const customNote = customItemsCount > 0
    ? ` | custom item ${customItemsCount} รายการ (ไม่กระทบ stock)` : "";
  await logActivity(
    poId, user.full_name, user.role, "received",
    `รับของ #${newNo} | สภาพ: ${input.overallCondition}${stockNote}${customNote}`,
  );

  // Notify admins (in-app) + creator (email สำหรับ "มีปัญหา" — 1 ใน 5 transitions)
  try {
    if (newStatus === "มีปัญหา") {
      await notifyAdmins(
        poId,
        `⚠️ ${po.po_number} มีปัญหา`,
        `${user.full_name} แจ้ง: ${input.issueDescription || "ของไม่ครบ"}`,
      );
      // Email creator — "issue" transition (1 ใน 5)
      if (po.created_by) {
        await notifyUser(
          po.created_by, poId,
          `⚠️ ${po.po_number} มีปัญหา`,
          `${user.full_name} แจ้ง: ${input.issueDescription || "ของไม่ครบ"}`,
          "po_status_change",
          {
            poNumber: po.po_number,
            emailKind: "issue",
            by: user.full_name,
            reason: input.issueDescription || undefined,
          },
        );
      }
    } else {
      // "รับของแล้ว" — admin in-app เดิม (ไม่ส่ง email — ไม่อยู่ใน 5 transitions)
      await notifyAdmins(
        poId,
        `📦 ${po.po_number} รับของแล้ว`,
        `${user.full_name} รับของเรียบร้อย`,
      );
    }
  } catch { /* ok */ }

  revalidatePath(`/po/${poId}`);
  revalidatePath("/po");
  revalidatePath("/po/pending-receipt");
  revalidatePath("/dashboard");
  return { ok: true, poId, poNumber: po.po_number };
}
