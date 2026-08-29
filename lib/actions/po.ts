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
  emailKind: "ordered" | "shipping" | "completed" | "cancelled" | "issue" | "reverted";
  by: string;
  trackingNumber?: string;
  reason?: string;
  supplierName?: string;
  expectedDate?: string;
  fromStatus?: string;   // for reverted
  toStatus?: string;
}

/**
 * แจ้งเตือน user ที่มีสิทธิ์ระดับสูง (admin + supervisor)
 * - in-app: ตาม pref `inapp_*`
 * - email: เฉพาะ kind="new_po" + pref `email_new_po` (default true)
 */
async function notifyAdmins(
  poId: string, title: string, message: string,
  kind: NotifyKind = "new_po",
  emailContext?: { poNumber: string; by: string; itemCount?: number; excludeUserId?: string },
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
  // Exclude user (กรณี admin/supervisor สร้าง PO เอง — ไม่ต้องส่ง noti ให้ตัวเอง)
  const rows = (privileged as Row[]).filter(
    (a) => !emailContext?.excludeUserId || a.id !== emailContext.excludeUserId,
  );

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
    .select("notification_prefs, email, full_name, is_active")
    .eq("id", userId)
    .maybeSingle();
  const user = u as {
    notification_prefs: NotificationPrefs | null;
    email: string | null;
    full_name: string;
    is_active: boolean | null;
  } | null;
  const prefs = user?.notification_prefs ?? null;

  // ผู้ใช้ที่ถูก deactivate — ห้ามส่งทั้ง in-app + email
  // ก่อน: notifyUser ไม่เช็ค is_active → deactivated user ยังได้อีเมล PO transitions
  if (user && user.is_active === false) {
    console.log(`[notifyUser] skip deactivated user ${userId} (${user.full_name})`);
    return;
  }

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
          fromStatus: emailContext.fromStatus,
          toStatus: emailContext.toStatus,
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
  console.log(`[po _updateStatus] ENTER — poId=${poId} newStatus=${newStatus} note=${note} tracking=${trackingNumber ?? "-"}`);
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };

  const sb = getSupabaseAdmin();
  const { data: po } = await sb
    .from("purchase_orders")
    .select("*")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };
  // Reject mutations on trashed PO (P1 — ship/receive/close/reopen ต้อง gate ก่อน)
  if (po.deleted_at) {
    return { ok: false, error: "PO นี้อยู่ในถังขยะ — กู้คืนก่อน" };
  }
  console.log(`[po _updateStatus] po.created_by=${po.created_by} po.po_number=${po.po_number}`);

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
      await notifyUser(
        po.created_by, poId,
        `🚚 ${po.po_number} กำลังขนส่ง`,
        `Supplier ส่งของแล้ว — เตรียมรับของได้`,
        "po_status_change",
        {
          poNumber: po.po_number,
          emailKind: "shipping",
          by: user.full_name,
          // Note: ไม่ส่ง trackingNumber ใน email/noti — แจ้งแค่ว่าจัดส่งแล้ว
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

// ==================================================================
// Bulk delete (privileged) — hard delete + cascade related rows
// ==================================================================
const DELETABLE_STATUSES: PoStatus[] = [
  "รอจัดซื้อดำเนินการ",  // ยังไม่ได้ทำอะไร — ลบได้
  "ยกเลิก",              // ยกเลิกแล้ว — archive ลบทิ้งได้
  // "เสร็จสมบูรณ์" — ห้ามลบ เก็บไว้เป็น record ของธุรกิจ
];

export interface BulkDeleteResult {
  ok: boolean;
  error?: string;
  deleted: number;
  blocked: number;          // PO ที่อยู่ใน status ไม่ใช่ deletable
  blockedDetails?: Array<{ poNumber: string; status: PoStatus }>;
}

export async function bulkDeletePoAction(
  poIds: string[],
  options?: { force?: boolean },
): Promise<BulkDeleteResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor", deleted: 0, blocked: 0 };
  }
  if (!poIds.length) {
    return { ok: false, error: "ไม่ได้เลือก PO", deleted: 0, blocked: 0 };
  }
  if (poIds.length > 100) {
    return {
      ok: false,
      error: "ลบสูงสุดได้ครั้งละ 100 ใบ",
      deleted: 0, blocked: 0,
    };
  }

  const sb = getSupabaseAdmin();

  // Feature flag: force-delete ต้องเปิดผ่าน env (NEXT_PUBLIC_FORCE_DELETE_ENABLED=true)
  // ปิดไว้ default — กันลบผิด + ใช้เมื่อจำเป็นจริง (เช่น cleanup test data)
  const forceEnabled =
    process.env.NEXT_PUBLIC_FORCE_DELETE_ENABLED === "true";
  const isForce = options?.force === true && forceEnabled;
  if (options?.force === true && !forceEnabled) {
    console.warn(
      `[bulkDelete] user ${user.full_name} attempted force-delete but flag is disabled`,
    );
    return {
      ok: false,
      error: "Force-delete ถูกปิดอยู่ — ติดต่อ admin เพื่อเปิดผ่าน env",
      deleted: 0,
      blocked: 0,
    };
  }

  // 1) ดึง PO ทั้งหมด — ตรวจ status + เก็บ URLs ของ attachments + delivery images
  //    เพื่อ cleanup storage blobs (กัน orphan files + privacy concern)
  //    + created_by เพื่อ notify creator
  const { data: pos } = await sb
    .from("purchase_orders")
    .select("id, po_number, status, attachment_urls, created_by")
    .in("id", poIds);

  type Row = {
    id: string;
    po_number: string;
    status: PoStatus;
    attachment_urls: PoAttachment[] | null;
    created_by: string | null;
  };
  const rows = (pos ?? []) as Row[];

  // Force mode: ลบทุก status (สำหรับล้าง test data) — admin/supervisor only
  // Normal mode: ลบเฉพาะ DELETABLE_STATUSES (รอจัดซื้อ/ยกเลิก)
  const deletable = isForce
    ? rows
    : rows.filter((p) => DELETABLE_STATUSES.includes(p.status));
  const blocked = isForce
    ? []
    : rows.filter((p) => !DELETABLE_STATUSES.includes(p.status));

  if (deletable.length === 0) {
    return {
      ok: false,
      error: `ลบไม่ได้ — PO ที่เลือกทั้ง ${blocked.length} ใบอยู่ใน workflow ที่ active`,
      deleted: 0,
      blocked: blocked.length,
      blockedDetails: blocked.map((p) => ({ poNumber: p.po_number, status: p.status })),
    };
  }

  const deletableIds = deletable.map((p) => p.id);

  // ⚠️ Storage cleanup ย้ายไป permanentDeletePoAction (เรียกจาก /trash)
  //    Soft delete ไม่ลบไฟล์เพราะอาจกู้คืน — ลบจริงตอน permanent delete
  const attachmentPaths: string[] = [];
  const deliveryImagePaths: string[] = [];

  // 3) Soft delete — move to trash (deleted_at = NOW())
  //    Related rows (activities, comments, deliveries, lots) ยังอยู่
  //    Permanent delete + cascade ทำตอน restoreFromTrash → permanentDeletePoAction
  const { error } = await sb
    .from("purchase_orders")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by_name: user.full_name,
    })
    .in("id", deletableIds);

  if (error) {
    console.error("[bulkDelete] failed:", error);
    return {
      ok: false,
      error: `ลบไม่สำเร็จ: ${error.message}`,
      deleted: 0,
      blocked: blocked.length,
    };
  }

  // (cleanup blocks below kept for permanentDeletePoAction reuse — no-op here since arrays are empty)
  if (attachmentPaths.length > 0) {
    try {
      const chunks: string[][] = [];
      for (let i = 0; i < attachmentPaths.length; i += 1000) {
        chunks.push(attachmentPaths.slice(i, i + 1000));
      }
      for (const chunk of chunks) {
        await sb.storage.from("po-attachments").remove(chunk);
      }
    } catch (e) {
      console.warn("[bulkDelete] cleanup po-attachments failed:", e);
    }
  }
  if (deliveryImagePaths.length > 0) {
    try {
      const chunks: string[][] = [];
      for (let i = 0; i < deliveryImagePaths.length; i += 1000) {
        chunks.push(deliveryImagePaths.slice(i, i + 1000));
      }
      for (const chunk of chunks) {
        await sb.storage.from("delivery-images").remove(chunk);
      }
    } catch (e) {
      console.warn("[bulkDelete] cleanup delivery-images failed:", e);
    }
  }

  // Audit log — เขียน activity ของแต่ละ PO (visible ใน /audit page)
  try {
    const activities = deletable.map((p) => ({
      po_id: p.id,
      user_name: user.full_name,
      user_role: user.role,
      action: "trashed",
      description: `ย้ายไปถังขยะ${isForce ? " (force mode)" : ""} — สถานะตอนลบ: ${p.status}`,
    }));
    if (activities.length > 0) {
      await sb.from("po_activities" as never).insert(activities as never);
    }
  } catch (e) {
    console.warn("[bulkDelete] activity log failed:", e);
  }

  // Notify creators (in-app) — ถ้าไม่ใช่คนลบเอง → creator จะรู้ว่า PO ของตัวเองถูกย้ายไปถังขยะ
  // (in-app only — ไม่ส่ง email เพราะถังขยะกู้คืนได้ ไม่ critical เท่ายกเลิก)
  try {
    const notifications = deletable
      .filter((p) => p.created_by && p.created_by !== user.id)
      .map((p) => ({
        user_id: p.created_by!,
        po_id: p.id,
        title: `🗑️ ${p.po_number} ถูกย้ายไปถังขยะ`,
        message: `โดย ${user.full_name} — กู้คืนได้ที่ /trash`,
      }));
    if (notifications.length > 0) {
      await sb.from("notifications").insert(notifications as never);
    }
  } catch (e) {
    console.warn("[bulkDelete] notify creators failed:", e);
  }

  console.log(
    `[bulkDelete TRASH${isForce ? " FORCE" : ""}] user=${user.full_name} (${user.role}) moved ${deletable.length} PO(s) to trash: ${
      deletable.map((p) => `${p.po_number}(${p.status})`).join(", ")
    }` +
    (blocked.length ? ` | blocked: ${blocked.map((p) => `${p.po_number}(${p.status})`).join(", ")}` : ""),
  );

  revalidatePath("/po");
  revalidatePath("/po/pending-receipt");
  revalidatePath("/dashboard");
  revalidatePath("/audit");
  revalidatePath("/reports");
  revalidatePath("/lots");
  revalidatePath("/trash");

  return {
    ok: true,
    deleted: deletable.length,
    blocked: blocked.length,
    blockedDetails: blocked.length
      ? blocked.map((p) => ({ poNumber: p.po_number, status: p.status }))
      : undefined,
  };
}

// ==================================================================
// Trash: restore + permanent delete (PO)
// ==================================================================
export async function restorePoFromTrashAction(
  poIds: string[],
): Promise<ActionResult & { restored?: number }> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  if (!poIds.length) return { ok: false, error: "ไม่ได้เลือก PO" };
  if (poIds.length > 100) return { ok: false, error: "กู้คืนสูงสุด 100 ใบ/ครั้ง" };

  const sb = getSupabaseAdmin();
  // อ่าน PO ที่จะกู้คืนก่อน (สำหรับ activity log + race check)
  const { data: rowsToRestore } = await sb
    .from("purchase_orders")
    .select("id, po_number, status")
    .in("id", poIds)
    .not("deleted_at", "is", null);
  type RestoreRow = { id: string; po_number: string; status: string };
  const validIds = ((rowsToRestore ?? []) as RestoreRow[]).map((r) => r.id);

  // Race protection — ถ้าไม่มีอะไรอยู่ในถังขยะตามที่เลือก → คนอื่นกู้ไปก่อนแล้ว
  if (validIds.length === 0) {
    return {
      ok: false,
      error: "PO ทุกใบที่เลือกถูกกู้คืนโดยผู้ใช้คนอื่นแล้ว — refresh หน้าเพื่อดูข้อมูลล่าสุด",
    };
  }

  const { error, count } = await sb
    .from("purchase_orders")
    .update({ deleted_at: null, deleted_by_name: null } as never, { count: "exact" })
    .in("id", validIds);
  if (error) {
    console.error("[po restoreFromTrash] failed:", error);
    return { ok: false, error: "กู้คืนไม่สำเร็จ" };
  }

  // Audit log — เขียน activity ให้แต่ละ PO
  try {
    const activities = ((rowsToRestore ?? []) as RestoreRow[]).map((p) => ({
      po_id: p.id,
      user_name: user.full_name,
      user_role: user.role,
      action: "restored",
      description: `กู้คืนจากถังขยะ — สถานะ: ${p.status}`,
    }));
    if (activities.length > 0) {
      await sb.from("po_activities" as never).insert(activities as never);
    }
  } catch (e) {
    console.warn("[po restoreFromTrash] activity log failed:", e);
  }

  console.log(`[po RESTORE] user=${user.full_name} restored ${count ?? 0} PO(s) from trash`);

  // Comprehensive cache invalidation (match bulkDelete revalidate list)
  revalidatePath("/po");
  revalidatePath("/po/[id]", "page");
  revalidatePath("/po/pending-receipt");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/audit");
  revalidatePath("/lots");
  revalidatePath("/trash");
  return { ok: true, restored: count ?? 0 };
}

export async function permanentDeletePoAction(
  poIds: string[],
): Promise<BulkDeleteResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor", deleted: 0, blocked: 0 };
  }
  if (!poIds.length) return { ok: false, error: "ไม่ได้เลือก PO", deleted: 0, blocked: 0 };
  if (poIds.length > 100) {
    return { ok: false, error: "ลบสูงสุด 100 ใบ/ครั้ง", deleted: 0, blocked: 0 };
  }

  const sb = getSupabaseAdmin();

  // ตรวจว่าทุก PO อยู่ในถังขยะจริง (deleted_at NOT NULL) — กันลบ active โดยไม่ตั้งใจ
  const { data: rows } = await sb
    .from("purchase_orders")
    .select("id, po_number, status, attachment_urls, deleted_at")
    .in("id", poIds);

  type Row = {
    id: string;
    po_number: string;
    status: PoStatus;
    attachment_urls: PoAttachment[] | null;
    deleted_at: string | null;
  };
  const all = (rows ?? []) as Row[];
  const trashed = all.filter((r) => r.deleted_at !== null);

  if (trashed.length === 0) {
    return {
      ok: false,
      error: "PO ที่เลือกไม่อยู่ในถังขยะ — ลบจากถังขยะเท่านั้น",
      deleted: 0,
      blocked: all.length,
    };
  }

  const ids = trashed.map((r) => r.id);

  // เก็บ storage paths สำหรับ cleanup
  function extractStoragePath(url: string, bucket: string): string | null {
    const marker = `/object/public/${bucket}/`;
    const idx = url.indexOf(marker);
    if (idx < 0) return null;
    return url.substring(idx + marker.length);
  }
  const attachmentPaths: string[] = [];
  for (const r of trashed) {
    for (const a of (r.attachment_urls ?? [])) {
      const p = extractStoragePath(a.url, "po-attachments");
      if (p) attachmentPaths.push(p);
    }
  }
  const deliveryImagePaths: string[] = [];
  try {
    const { data: deliveries } = await sb
      .from("po_deliveries" as never)
      .select("image_urls")
      .in("po_id", ids);
    type DRow = { image_urls: string[] | null };
    for (const d of ((deliveries ?? []) as DRow[])) {
      for (const url of (d.image_urls ?? [])) {
        const p = extractStoragePath(url, "delivery-images");
        if (p) deliveryImagePaths.push(p);
      }
    }
  } catch { /* ok */ }

  // Cascade delete related — parallel (each independent, no ordering dep)
  //   ก่อน: sequential — 4x roundtrips + partial-fail leaves orphans
  //   หลัง: Promise.allSettled — 1x wall clock + collect failures for retry
  const cascadeResults = await Promise.allSettled([
    sb.from("po_activities" as never).delete().in("po_id", ids),
    sb.from("po_comments" as never).delete().in("po_id", ids),
    sb.from("po_deliveries" as never).delete().in("po_id", ids),
    sb.from("notifications").delete().in("po_id", ids),
  ]);
  const cascadeFailures = cascadeResults
    .map((r, i) => ({
      table: ["po_activities", "po_comments", "po_deliveries", "notifications"][i],
      failed: r.status === "rejected"
        ? r.reason
        : (r.value as { error?: unknown })?.error,
    }))
    .filter((r) => r.failed);
  if (cascadeFailures.length > 0) {
    console.warn("[permanentDelete] cascade partial fail:", cascadeFailures);
  }
  // lots: ON DELETE SET NULL — preserve lot history

  // Delete PO rows
  const { error } = await sb.from("purchase_orders").delete().in("id", ids);
  if (error) {
    console.error("[permanentDelete] failed:", error);
    return { ok: false, error: `ลบไม่สำเร็จ: ${error.message}`, deleted: 0, blocked: 0 };
  }

  // Storage cleanup (best-effort)
  if (attachmentPaths.length > 0) {
    try { await sb.storage.from("po-attachments").remove(attachmentPaths); }
    catch (e) { console.warn("[permanentDelete] storage po-attachments fail:", e); }
  }
  if (deliveryImagePaths.length > 0) {
    try { await sb.storage.from("delivery-images").remove(deliveryImagePaths); }
    catch (e) { console.warn("[permanentDelete] storage delivery-images fail:", e); }
  }

  console.log(
    `[po PERMANENT-DELETE] user=${user.full_name} (${user.role}) deleted ${trashed.length} PO(s): ` +
      `${trashed.map((p) => p.po_number).join(", ")} | storage: ${attachmentPaths.length} attachments + ${deliveryImagePaths.length} delivery images`,
  );

  revalidatePath("/trash");
  revalidatePath("/po");
  revalidatePath("/po/pending-receipt");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/audit");
  revalidatePath("/lots");

  return { ok: true, deleted: trashed.length, blocked: all.length - trashed.length };
}

export async function closePoAction(poId: string): Promise<ActionResult> {
  // Permission: creator + privileged (admin/supervisor) เท่านั้น
  // (เดิม: ไม่มี role gate — staff คนใดๆ ก็เรียกได้)
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };

  // Workflow gate: ปิดงานได้เฉพาะหลังจากรับของแล้วเท่านั้น
  const sb = getSupabaseAdmin();
  const { data: po } = await sb
    .from("purchase_orders")
    .select("status, created_by, deleted_at")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };
  if (po.deleted_at) {
    return { ok: false, error: "PO นี้อยู่ในถังขยะ — กู้คืนก่อน" };
  }
  // Permission check: privileged หรือ creator
  const isPrivileged = user.role === "admin" || user.role === "supervisor";
  if (!isPrivileged && po.created_by !== user.id) {
    return { ok: false, error: "คุณไม่ใช่เจ้าของ PO นี้" };
  }
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
 * ใช้ atomic RPC (post migration 202608 จะ RAISE stock_underflow ถ้าไม่พอ)
 * + fallback non-atomic เมื่อ RPC ยังไม่ deploy
 * + ลบ lots ที่สร้างจาก PO นี้ (คืน lot inventory ครบวง)
 *
 * Throws:
 *   Error("stock_underflow") ถ้า RPC RAISE — caller ต้อง catch + rollback
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
    // Atomic decrement ผ่าน RPC — RAISE stock_underflow ถ้าไม่พอ (post 202608)
    let useRpc = true;
    try {
      const { error: rpcErr } = await sb.rpc("increment_equipment_stock", {
        p_id: eqId, p_qty: -qty,
      });
      if (rpcErr) {
        const msg = (rpcErr as { message?: string })?.message?.toLowerCase() ?? "";
        // Business RAISE → propagate (caller ตัดสินใจว่าจะทำยังไง)
        if (msg.includes("stock_underflow")) {
          throw new Error(`stock_underflow: equipment=${eqId} qty=${qty}`);
        }
        // RPC missing / other DB error → fall back
        useRpc = false;
      }
    } catch (e) {
      // Only propagate business RAISE — RPC-missing errors fall through
      if (e instanceof Error && e.message.startsWith("stock_underflow")) throw e;
      useRpc = false;
    }

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
        .update({
          stock: Math.max(0, cur - qty),
          updated_at: new Date().toISOString(),
        })
        .eq("id", eqId);
    }
    totalUnits += qty;
    itemsAffected++;
  }

  // ลบ lots ที่ถูกสร้างจาก PO นี้ — คืนสภาพก่อนรับของ
  // (ถูก block ก่อนแล้วถ้ามี withdrawals ref lots พวกนี้ — ดู cancelPoAction)
  try {
    await sb.from("lots" as never).delete().eq("po_id", poId);
  } catch (e) {
    console.warn("[rollback] lots delete skipped:", e);
  }

  return { totalUnits, itemsAffected };
}

/**
 * เช็คว่ามี withdrawal ใดๆ ที่กิน lot ที่มาจาก PO นี้หรือไม่
 * เช็คทั้ง 2 layer: legacy withdrawals.lot_id + withdrawal_lot_usage table (F3)
 * Returns 0 ถ้าไม่มี — safe จะ delete lots + rollback stock ได้
 */
async function countWithdrawalsAgainstPoLots(poId: string): Promise<number> {
  const sb = getSupabaseAdmin();
  try {
    const { data: lotRows } = await sb
      .from("lots" as never)
      .select("id")
      .eq("po_id", poId);
    const lotIds = ((lotRows ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (lotIds.length === 0) return 0;

    const [legacy, usage] = await Promise.all([
      sb.from("withdrawals").select("id", { count: "exact", head: true }).in("lot_id", lotIds),
      sb
        .from("withdrawal_lot_usage" as never)
        .select("id", { count: "exact", head: true })
        .in("lot_id", lotIds),
    ]);
    return Math.max(legacy.count ?? 0, usage.count ?? 0);
  } catch {
    // Tables may not exist yet — treat as 0
    return 0;
  }
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
    .select("created_by, status, deleted_at")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };
  if (po.deleted_at) {
    return { ok: false, error: "PO นี้อยู่ในถังขยะ — กู้คืนก่อน" };
  }

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

  // Extra gate: requester ยกเลิกได้เฉพาะช่วงต้น flow เท่านั้น
  //   - รอจัดซื้อ / สั่งซื้อแล้ว → OK
  //   - กำลังขนส่ง / รับของแล้ว / มีปัญหา → ต้องแอดมิน (stock/lot สลับซับซ้อน)
  if (user.role === "requester") {
    const requesterCancellable: PoStatus[] = [
      "รอจัดซื้อดำเนินการ", "สั่งซื้อแล้ว",
    ];
    if (!requesterCancellable.includes(po.status as PoStatus)) {
      return {
        ok: false,
        error:
          `ยกเลิกเองไม่ได้ — สถานะ "${po.status}" แล้ว. ` +
          `แจ้งแอดมินให้ยกเลิก (ต้อง revert stock/lot)`,
      };
    }
  }

  // Stock rollback: ถ้าเคยรับของไปแล้ว → ถอย stock ออก
  let rollbackNote = "";
  if (RECEIVED_STATUSES.includes(po.status as PoStatus)) {
    // Block ถ้ามีการเบิกจาก lot ที่มาจาก PO นี้แล้ว (data-consistency guard)
    // ไม่งั้น: cancel = ลด stock ทั้งก้อนคืน แต่ lots ที่ถูกเบิกไปแล้ว
    // จะทำให้ SUM(lots.qty_remaining) > equipment.stock (drift)
    const wCount = await countWithdrawalsAgainstPoLots(poId);
    if (wCount > 0) {
      return {
        ok: false,
        error:
          `ยกเลิกไม่ได้ — มีการเบิก ${wCount} รายการจาก lot ของ PO นี้แล้ว. ` +
          `ลบ withdrawal พวกนั้นก่อน หรือใช้ credit note ทาง manual`,
      };
    }

    try {
      const rb = await rollbackPoStock(poId);
      if (rb.totalUnits > 0) {
        rollbackNote = ` | ถอย stock ${rb.totalUnits} ชิ้น (${rb.itemsAffected} รายการ) + ลบ lots`;
      }
    } catch (e) {
      // Business errors (stock_underflow) จาก RPC RAISE — block cancel
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.startsWith("stock_underflow")) {
        return {
          ok: false,
          error:
            "ยกเลิกไม่ได้ — คืน stock แล้วจะทำให้ติดลบ. ตรวจ withdrawals ที่ใช้ของ PO นี้",
        };
      }
      // อื่นๆ — log ไม่ block (defensive)
      console.error("[cancel] stock rollback failed:", e);
      rollbackNote = " | ⚠️ rollback stock ไม่สำเร็จ — ตรวจ manual";
    }
  }

  return _updateStatus(poId, "ยกเลิก", `${reason}${rollbackNote}`);
}

// ==================================================================
// Revert status (privileged) — ย้อนสถานะกลับไป step ก่อนหน้า
// แก้กรณีกดผิดหรือต้องแก้ข้อมูล
// ==================================================================

/** Map: status → status ก่อนหน้า (null ถ้า revert ไม่ได้) */
const STATUS_PREDECESSORS: Partial<Record<PoStatus, PoStatus>> = {
  "สั่งซื้อแล้ว": "รอจัดซื้อดำเนินการ",
  "กำลังขนส่ง": "สั่งซื้อแล้ว",
  "รับของแล้ว": "กำลังขนส่ง",
  "มีปัญหา": "กำลังขนส่ง",
  "เสร็จสมบูรณ์": "รับของแล้ว",
  // "ยกเลิก" → ไม่ revert (ไม่รู้ status ก่อนถูก cancel)
  // "รอจัดซื้อดำเนินการ" → initial state ไม่มีก่อนหน้า
};

export async function revertStatusAction(
  poId: string,
  reason: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }

  const sb = getSupabaseAdmin();
  const { data: po } = await sb
    .from("purchase_orders")
    .select("*")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };
  if (po.deleted_at) {
    return { ok: false, error: "PO นี้อยู่ในถังขยะ — กู้คืนก่อน" };
  }

  const currentStatus = po.status as PoStatus;
  const prevStatus = STATUS_PREDECESSORS[currentStatus];
  if (!prevStatus) {
    return {
      ok: false,
      error: currentStatus === "รอจัดซื้อดำเนินการ"
        ? "อยู่ที่ขั้นแรกแล้ว — ย้อนกลับไม่ได้"
        : currentStatus === "ยกเลิก"
          ? "PO ถูกยกเลิกแล้ว — ใช้ Clone สร้างใหม่แทน"
          : `ย้อนกลับจาก "${currentStatus}" ไม่ได้`,
    };
  }

  // Build update + apply rollback per transition
  const update: Record<string, unknown> = {
    status: prevStatus,
    updated_at: new Date().toISOString(),
  };

  // Track special handling
  let rollbackNote = "";

  // F4 — Pre-revert snapshot สำหรับ audit log
  //      เก็บค่าเก่าก่อน clear → ใส่ใน activity log สำหรับ trace + recover ภายหลัง
  const preRevertSnapshot: Record<string, unknown> = {};

  // ──────────────────────────────────────────────
  // Case 1: สั่งซื้อแล้ว → รอจัดซื้อ
  //   - Clear supplier + dates + prices + totals
  //   - Reset items prices
  // ──────────────────────────────────────────────
  if (currentStatus === "สั่งซื้อแล้ว") {
    // F4: snapshot ค่าก่อน clear
    preRevertSnapshot.supplier_name = po.supplier_name;
    preRevertSnapshot.supplier_contact = po.supplier_contact;
    preRevertSnapshot.ordered_date = po.ordered_date;
    preRevertSnapshot.expected_date = po.expected_date;
    preRevertSnapshot.subtotal = po.subtotal;
    preRevertSnapshot.discount = po.discount;
    preRevertSnapshot.shipping_fee = po.shipping_fee;
    preRevertSnapshot.vat = po.vat;
    preRevertSnapshot.total = po.total;
    preRevertSnapshot.procurement_notes = po.procurement_notes;
    // เก็บราคา per item (เก็บแบบสรุป — name + unit_price)
    const itemPrices = ((po.items ?? []) as PoItem[])
      .filter((it) => (it.unit_price ?? 0) > 0)
      .map((it) => ({ name: it.name, unit_price: it.unit_price }));
    if (itemPrices.length > 0) preRevertSnapshot.item_prices = itemPrices;

    update.supplier_name = null;
    update.supplier_contact = null;
    update.supplier_id = null;
    update.ordered_date = null;
    update.expected_date = null;
    update.subtotal = null;
    update.discount = null;
    update.shipping_fee = null;
    update.vat = null;
    update.total = null;
    update.procurement_notes = null;
    // Reset prices in items[]
    const items = (po.items ?? []) as PoItem[];
    const cleanItems = items.map((it) => ({
      ...it,
      unit_price: 0,
      subtotal: 0,
    }));
    update.items = cleanItems;
    rollbackNote = " | ล้างข้อมูล supplier + ราคา";
  }

  // ──────────────────────────────────────────────
  // Case 2: กำลังขนส่ง → สั่งซื้อแล้ว
  //   - Clear tracking
  // ──────────────────────────────────────────────
  if (currentStatus === "กำลังขนส่ง") {
    if (po.tracking_number) preRevertSnapshot.tracking_number = po.tracking_number;
    update.tracking_number = null;
    rollbackNote = " | ล้าง tracking";
  }

  // ──────────────────────────────────────────────
  // Case 3: รับของแล้ว/มีปัญหา → กำลังขนส่ง
  //   - Check: ห้ามมี withdrawals ที่ใช้ lot จาก PO นี้
  //   - Rollback stock จาก last delivery
  //   - Delete last delivery + lots
  // ──────────────────────────────────────────────
  if (currentStatus === "รับของแล้ว" || currentStatus === "มีปัญหา") {
    // 3.0) Check จำนวน delivery — ถ้ามี >1 รอบ ห้าม revert (asymmetric rollback)
    //      เพราะ revert ลบแค่ delivery ล่าสุด → stock + audit ของ delivery เก่ายังค้าง
    //      → ไม่สมมาตร อาจเพี้ยน → force ใช้ cancel แทน (rollback ครบทุก delivery)
    const { count: deliveryCount } = await sb
      .from("po_deliveries" as never)
      .select("id", { count: "exact", head: true })
      .eq("po_id", poId);
    if ((deliveryCount ?? 0) > 1) {
      return {
        ok: false,
        error: `ย้อนสถานะไม่ได้ — PO นี้รับของ ${deliveryCount} รอบแล้ว ` +
               `(ลบเฉพาะรอบสุดท้ายจะทำให้ stock เพี้ยน). ` +
               `ใช้ "ยกเลิก" PO แทนถ้าต้องการ rollback ทั้งหมด`,
      };
    }

    // 3.1) Check withdrawals — block ถ้ามีการเบิกจาก lot ของ PO นี้
    //      ตรวจทั้ง 2 layer: legacy withdrawals.lot_id + withdrawal_lot_usage (F3)
    //      ก่อน: เช็คแค่ withdrawals.lot_id — multi-lot ที่ primary ต่างกันหลุด
    const withdrawalCount = await countWithdrawalsAgainstPoLots(poId);
    if (withdrawalCount > 0) {
      return {
        ok: false,
        error: `ย้อนสถานะไม่ได้ — มีการเบิก ${withdrawalCount} รายการจาก lot ของ PO นี้แล้ว`,
      };
    }

    // 3.2) Get last delivery
    const { data: deliveries } = await sb
      .from("po_deliveries" as never)
      .select("id, delivery_no, items_received")
      .eq("po_id", poId)
      .order("delivery_no", { ascending: false })
      .limit(1);
    type DRow = {
      id: string;
      delivery_no: number;
      items_received: Array<{
        equipment_id: string | null;
        qty_received: number;
      }>;
    };
    const lastDelivery = ((deliveries ?? []) as unknown as DRow[])[0];

    let stockRollbackCount = 0;
    if (lastDelivery) {
      // 3.3) Rollback stock for each equipment item in last delivery
      //      ก่อน: try/catch เงียบ — RPC error กลายเป็น silent success (P1 bug)
      //      หลัง: propagate error → return ให้ user แก้
      for (const item of lastDelivery.items_received ?? []) {
        if (!item.equipment_id) continue;
        const qty = Math.floor(item.qty_received ?? 0);
        if (qty <= 0) continue;
        const { error: rpcErr } = await sb.rpc("increment_equipment_stock", {
          p_id: item.equipment_id,
          p_qty: -qty,
        });
        if (rpcErr) {
          const msg = (rpcErr as { message?: string })?.message?.toLowerCase() ?? "";
          if (msg.includes("stock_underflow")) {
            return {
              ok: false,
              error:
                `ย้อนสถานะไม่ได้ — คืน stock ${qty} จะทำให้ติดลบ ` +
                `(equipment_id=${item.equipment_id}). ตรวจ withdrawal ที่ใช้ของ delivery นี้ก่อน`,
            };
          }
          // RPC missing / อื่นๆ → warn ต่อ (fallback ทำงานอัตโนมัติภายใน RPC layer หรือ manual)
          console.warn("[revert] stock rollback RPC error:", rpcErr);
        }
        stockRollbackCount++;
      }

      // 3.4) Delete lots from this delivery (no withdrawals ref'd — already checked)
      try {
        await sb.from("lots" as never).delete().eq("po_delivery_id", lastDelivery.id);
      } catch { /* skip if lots table missing */ }

      // 3.5) Delete the delivery row
      await sb
        .from("po_deliveries" as never)
        .delete()
        .eq("id", lastDelivery.id);

      // Clear received_date เฉพาะเมื่อมี delivery ที่เพิ่งลบจริง
      // (defensive: ถ้าข้อมูล inconsistent — status=รับของแล้ว แต่ deliveryCount=0
      //  เราไม่ควรล้าง received_date เก่าทิ้ง)
      update.received_date = null;
    }

    rollbackNote = lastDelivery
      ? ` | ยกเลิก delivery #${lastDelivery.delivery_no} (rollback stock ${stockRollbackCount} รายการ)`
      : " | ไม่พบ delivery";
  }

  // ──────────────────────────────────────────────
  // Case 4: เสร็จสมบูรณ์ → รับของแล้ว
  //   - แค่เปลี่ยน status (received_date ยังเก็บไว้)
  // ──────────────────────────────────────────────
  if (currentStatus === "เสร็จสมบูรณ์") {
    rollbackNote = " | reopen งาน";
  }

  // Apply update
  const { error } = await sb
    .from("purchase_orders")
    .update(update)
    .eq("id", poId);
  if (error) {
    console.error("[revert] update failed:", error);
    return { ok: false, error: "บันทึกไม่สำเร็จ" };
  }

  // Activity log + F4 snapshot ของข้อมูลก่อน revert
  const snapshotKeys = Object.keys(preRevertSnapshot);
  const snapshotNote = snapshotKeys.length > 0
    ? ` | snapshot=${JSON.stringify(preRevertSnapshot)}`
    : "";
  await logActivity(
    poId, user.full_name, user.role, "status_reverted",
    `ย้อน: ${currentStatus} → ${prevStatus}${reason ? ` | ${reason}` : ""}${rollbackNote}${snapshotNote}`,
  );

  // F6: Notify creator — ส่ง email kind="reverted" (privacy: ไม่ส่ง snapshot ใน email)
  if (po.created_by) {
    try {
      await notifyUser(
        po.created_by, poId,
        `↩️ ${po.po_number} ถูกย้อนสถานะ`,
        `${currentStatus} → ${prevStatus} • โดย ${user.full_name}${reason ? ` • ${reason}` : ""}`,
        "po_status_change",
        {
          poNumber: po.po_number,
          emailKind: "reverted",
          by: user.full_name,
          reason: reason || undefined,
          fromStatus: currentStatus,
          toStatus: prevStatus,
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
// Ship (admin) — update tracking + status to กำลังขนส่ง
// ==================================================================
export async function shipPoAction(
  poId: string, trackingNumber: string, note: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  const tracking = (trackingNumber ?? "").trim();
  if (!tracking) {
    return { ok: false, error: "กรุณากรอกเลข tracking" };
  }
  return _updateStatus(poId, "กำลังขนส่ง", note, tracking);
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

  // Permission gate: ผู้ใช้ต้องมีสิทธิ์เห็น PO ต้นทาง
  //  - Privileged: ทุก PO
  //  - Requester: เฉพาะ PO ที่ตัวเองสร้าง หรือ status >= "สั่งซื้อแล้ว" (team-visible)
  const sourcePoForPerm = source as PurchaseOrder;
  const isPrivileged = user.role === "admin" || user.role === "supervisor";
  const isCreator = sourcePoForPerm.created_by === user.id;
  const TEAM_VISIBLE: PoStatus[] = [
    "สั่งซื้อแล้ว", "กำลังขนส่ง", "รับของแล้ว", "มีปัญหา", "เสร็จสมบูรณ์",
  ];
  if (!isPrivileged && !isCreator && !TEAM_VISIBLE.includes(sourcePoForPerm.status as PoStatus)) {
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
  revalidatePath("/po/pending-receipt");
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
  // Message size guard
  if (message.length > 2000) {
    return { ok: false, error: "ข้อความยาวเกินไป (จำกัด 2000 ตัวอักษร)" };
  }
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };

  const sb = getSupabaseAdmin();

  // Permission gate: ต้องเห็น PO ได้ก่อนถึงจะคอมเมนต์ได้
  //  - Privileged: ทุก PO
  //  - Requester: เฉพาะ PO ของตัวเอง หรือ PO ที่ status >= "สั่งซื้อแล้ว" (team-visible)
  const { data: po } = await sb
    .from("purchase_orders")
    .select("created_by, status, deleted_at")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };
  if (po.deleted_at) {
    return { ok: false, error: "PO นี้อยู่ในถังขยะ — กู้คืนก่อน" };
  }

  const isPrivileged = user.role === "admin" || user.role === "supervisor";
  const isCreator = po.created_by === user.id;
  const TEAM_VISIBLE = ["สั่งซื้อแล้ว", "กำลังขนส่ง", "รับของแล้ว", "มีปัญหา", "เสร็จสมบูรณ์"];
  const canSee = isPrivileged || isCreator || TEAM_VISIBLE.includes(po.status);
  if (!canSee) {
    return { ok: false, error: "ไม่มีสิทธิ์คอมเมนต์ใน PO นี้" };
  }

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
  console.log(`[po addPoAttachmentsAction] ENTER — poId=${poId} files=${newAttachments.length} category=${category}`);
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };
  if (!newAttachments.length) return { ok: false, error: "ไม่มีไฟล์" };

  // Validate poId — UUID 36 chars
  if (!poId || typeof poId !== "string" || poId.length < 32) {
    console.error(`[po addPoAttachmentsAction] invalid poId: ${JSON.stringify(poId)}`);
    return { ok: false, error: `poId ไม่ถูกต้อง (${poId?.length ?? 0} chars)` };
  }

  const sb = getSupabaseAdmin();

  // Race-safe read-modify-write ด้วย optimistic lock บน updated_at:
  //   ก่อน: 2 concurrent uploaders → each reads same attachment_urls → last write wins
  //   หลัง: UPDATE ... WHERE updated_at=<seen> → conflict = re-read + retry (≤3)
  interface PoRow {
    id: string;
    attachment_urls: PoAttachment[] | null;
    po_number: string;
    created_by: string | null;
    status: string;
    deleted_at: string | null;
    updated_at: string;
  }

  let retries = 0;
  const MAX_RETRIES = 3;
  let poRow: PoRow | null = null;
  let mergedFinal = 0;

  while (retries < MAX_RETRIES) {
    const { data, error: selectErr } = await sb
      .from("purchase_orders")
      .select("id, attachment_urls, po_number, created_by, status, deleted_at, updated_at")
      .eq("id", poId)
      .maybeSingle();
    if (selectErr) {
      console.error("[po addPoAttachmentsAction] select error:", selectErr);
      return { ok: false, error: `Query error: ${selectErr.message}` };
    }
    if (!data) {
      console.error(`[po addPoAttachmentsAction] PO not found with id=${poId}`);
      return { ok: false, error: `ไม่พบใบ PO (id=${poId.slice(0, 8)}...)` };
    }
    poRow = data as unknown as PoRow;

    if (poRow.deleted_at) {
      return { ok: false, error: "PO นี้อยู่ในถังขยะ — กู้คืนก่อน" };
    }
    const isPrivileged = user.role === "admin" || user.role === "supervisor";
    if (!isPrivileged && poRow.created_by !== user.id) {
      return { ok: false, error: "คุณไม่ใช่เจ้าของ PO นี้" };
    }
    if (poRow.status === "เสร็จสมบูรณ์" || poRow.status === "ยกเลิก") {
      return { ok: false, error: `แนบไฟล์ไม่ได้ — PO ${poRow.status} แล้ว` };
    }

    const existing: PoAttachment[] = (poRow.attachment_urls ?? []) as PoAttachment[];
    const enriched = newAttachments.map((a) => ({
      ...a,
      category,
      uploaded_by: user.full_name,
    }));
    const merged = [...existing, ...enriched];
    mergedFinal = merged.length;

    // Optimistic lock: UPDATE เฉพาะเมื่อ updated_at ยังตรงกับที่ read มา
    const newUpdatedAt = new Date().toISOString();
    const { data: updated, error: updateErr } = await sb
      .from("purchase_orders")
      .update({
        attachment_urls: merged,
        updated_at: newUpdatedAt,
      })
      .eq("id", poId)
      .eq("updated_at", poRow.updated_at)
      .select("id")
      .maybeSingle();
    if (updateErr) {
      console.error("[po addPoAttachmentsAction] update error:", updateErr);
      return { ok: false, error: `บันทึกไม่สำเร็จ: ${updateErr.message}` };
    }
    if (updated) {
      console.log(
        `[po addPoAttachmentsAction] SUCCESS retry=${retries} — total attachments now=${merged.length}`,
      );
      break;
    }
    // Version conflict — someone raced. Re-read + retry
    retries++;
    console.warn(
      `[po addPoAttachmentsAction] version conflict, retry ${retries}/${MAX_RETRIES}`,
    );
  }
  if (retries >= MAX_RETRIES) {
    return {
      ok: false,
      error: "บันทึกไม่สำเร็จ — มีการแก้ไขพร้อมกัน กรุณาลองอีกครั้ง",
    };
  }
  if (!poRow) {
    return { ok: false, error: "ไม่พบใบ PO" };
  }
  const po = poRow;
  void mergedFinal;

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
    .select("attachment_urls, created_by, status, deleted_at")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };
  if (po.deleted_at) {
    return { ok: false, error: "PO นี้อยู่ในถังขยะ — กู้คืนก่อน" };
  }

  // Permission gate: privileged หรือ creator เท่านั้น
  const isPrivileged = user.role === "admin" || user.role === "supervisor";
  if (!isPrivileged && po.created_by !== user.id) {
    return { ok: false, error: "คุณไม่ใช่เจ้าของ PO นี้" };
  }
  // ห้ามลบไฟล์เมื่อ PO อยู่ใน terminal state (preserve audit trail)
  if (po.status === "เสร็จสมบูรณ์" || po.status === "ยกเลิก") {
    return { ok: false, error: `ลบไฟล์ไม่ได้ — PO ${po.status} แล้ว` };
  }

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
// Link supplier_id to PO — เรียกหลัง register Supplier ใหม่จากหน้า PO
//
// Use case: PO ที่มี supplier_name (typed as free text) แต่ supplier_id=null
//   → user กดปุ่ม "เพิ่ม Supplier ใหม่" → SupplierDialog เปิด pre-fill ชื่อ
//   → กดบันทึก → ได้ supplierId กลับ → call action นี้เพื่อ link FK
// ==================================================================
export async function linkSupplierToPoAction(
  poId: string,
  supplierId: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  if (!poId || !supplierId) {
    return { ok: false, error: "ข้อมูลไม่ครบ" };
  }

  const sb = getSupabaseAdmin();
  // Sanity check: supplier มีจริง + active + ไม่อยู่ในถังขยะ
  const { data: sup } = await sb
    .from("suppliers" as never)
    .select("id, name, is_active, deleted_at")
    .eq("id", supplierId)
    .is("deleted_at", null)
    .maybeSingle();
  type SupRow = { id: string; name: string; is_active: boolean; deleted_at: string | null };
  const supRow = sup as SupRow | null;
  if (!supRow) return { ok: false, error: "ไม่พบ Supplier (หรืออยู่ในถังขยะ)" };

  const { data: po } = await sb
    .from("purchase_orders")
    .select("id, po_number, supplier_name, supplier_id, deleted_at")
    .eq("id", poId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };

  // Race guard — ถ้า PO ถูก link ไปแล้ว (เช่น admin อื่นกดพร้อมกัน)
  //   → ไม่ override (กัน orphan supplier + ป้องกันการเปลี่ยน link โดยไม่ตั้งใจ)
  if (po.supplier_id && po.supplier_id !== supplierId) {
    return {
      ok: false,
      error: "PO นี้ link Supplier ในระบบอยู่แล้ว — โปรด refresh หน้าเพื่อดูข้อมูลล่าสุด",
    };
  }
  // ถ้า link ไปยัง supplier เดียวกันอยู่แล้ว → idempotent success
  if (po.supplier_id === supplierId) {
    return { ok: true, poId };
  }

  // Atomic conditional update — เฉพาะตอน supplier_id ยังเป็น null
  // (กัน race ถึง 2 admin กดพร้อมกัน — request หลังจะได้ rowsUpdated=0)
  const { error, count } = await sb
    .from("purchase_orders")
    .update(
      {
        supplier_id: supplierId,
        // Sync ชื่อกับที่ register ใน DB (case-correct + trimmed)
        supplier_name: supRow.name,
        updated_at: new Date().toISOString(),
      },
      { count: "exact" },
    )
    .eq("id", poId)
    .is("supplier_id", null);
  if (error) {
    console.error("[po linkSupplierToPo] failed:", error);
    return { ok: false, error: "เชื่อมโยง Supplier ไม่สำเร็จ" };
  }
  // Race lost — มีคนอื่น link ไปก่อนหน้านี้ระหว่าง check กับ update
  if (count === 0) {
    return {
      ok: false,
      error: "PO นี้ถูก link โดยผู้ใช้คนอื่นแล้ว — refresh หน้าเพื่อดูข้อมูลล่าสุด",
    };
  }

  await logActivity(
    poId,
    user.full_name,
    user.role,
    "supplier_linked",
    `เชื่อมโยงกับ Supplier: ${supRow.name}`,
  );

  revalidatePath(`/po/${poId}`);
  revalidatePath("/po");
  return { ok: true, poId };
}

// ==================================================================
// Update procurement notes — แก้ไข "หมายเหตุจัดซื้อ" หลังสั่งไปแล้ว
//
// Use case: admin กรอก note ตอนสั่งซื้อแล้ว แต่อยากแก้เพิ่ม/แก้คำผิด/
//           เพิ่มข้อมูลหลังจากนั้น
// Permission: privileged (admin/supervisor) เท่านั้น — เพราะ procurement_notes
//             เป็น admin-only field อยู่แล้ว (staff มองไม่เห็น)
// Status gate: ห้ามแก้ตอน PO ถูก "ยกเลิก" (terminal — preserve audit trail)
// ==================================================================
// ==================================================================
// Update expected delivery date — แก้ "วันที่คาดว่าจะได้รับ" หลังสั่งไปแล้ว
//
// Use case: supplier เลื่อนส่ง / อัปเดต ETA ใหม่
// Permission: privileged (admin/supervisor)
// Status gate: เฉพาะ "สั่งซื้อแล้ว" / "กำลังขนส่ง" (ในระหว่างรอของ)
//   — รอจัดซื้อ: ตั้งตอน order, ยกเลิก/เสร็จ/รับแล้ว: irrelevant
// ==================================================================
export async function updateExpectedDateAction(
  poId: string,
  expectedDate: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  if (!poId) return { ok: false, error: "ข้อมูลไม่ครบ" };

  // Validate date — strict ISO YYYY-MM-DD
  if (!expectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(expectedDate)) {
    return { ok: false, error: "รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)" };
  }
  const d = new Date(expectedDate + "T00:00:00.000Z");
  if (isNaN(d.getTime())) {
    return { ok: false, error: "วันที่ไม่ถูกต้อง" };
  }

  const sb = getSupabaseAdmin();
  const { data: po } = await sb
    .from("purchase_orders")
    .select("id, po_number, status, expected_date, created_by, deleted_at")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };
  if (po.deleted_at) {
    return { ok: false, error: "PO นี้อยู่ในถังขยะ — กู้คืนก่อน" };
  }
  const EDITABLE_STATUSES: PoStatus[] = ["สั่งซื้อแล้ว", "กำลังขนส่ง"];
  if (!EDITABLE_STATUSES.includes(po.status as PoStatus)) {
    return {
      ok: false,
      error: `แก้วันที่ได้เฉพาะ PO ที่ "สั่งซื้อแล้ว" หรือ "กำลังขนส่ง" — สถานะปัจจุบัน "${po.status}"`,
    };
  }

  const oldDate = po.expected_date ?? null;
  if (oldDate === expectedDate) {
    return { ok: true, poId }; // idempotent
  }

  const { error } = await sb
    .from("purchase_orders")
    .update({ expected_date: expectedDate, updated_at: new Date().toISOString() })
    .eq("id", poId);
  if (error) {
    console.error("[po updateExpectedDate] failed:", error);
    return { ok: false, error: "บันทึกไม่สำเร็จ" };
  }

  await logActivity(
    poId,
    user.full_name,
    user.role,
    "expected_date_changed",
    `แก้วันที่คาดว่าจะได้รับ: ${oldDate ?? "(ไม่ระบุ)"} → ${expectedDate}`,
  );

  // Notify creator (in-app) ถ้าไม่ใช่คนแก้เอง — ETA เปลี่ยนเป็นข้อมูลที่ creator ควรรู้
  try {
    if (po.created_by && po.created_by !== user.id) {
      await sb.from("notifications").insert({
        user_id: po.created_by,
        po_id: poId,
        title: `📅 ${po.po_number} อัปเดตวันที่คาดว่าจะได้รับ`,
        message: `เป็น ${expectedDate} โดย ${user.full_name}`,
      } as never);
    }
  } catch (e) {
    console.warn("[po updateExpectedDate] notify failed:", e);
  }

  revalidatePath(`/po/${poId}`);
  revalidatePath("/po");
  revalidatePath("/po/pending-receipt");
  revalidatePath("/dashboard");
  return { ok: true, poId };
}

// ==================================================================
// Edit prices — แก้ราคาต่อรายการ + discount/shipping/vat หลังสั่งไปแล้ว
//
// Use case: admin กรอกราคาผิด หรือได้ราคาใหม่จาก supplier
// Permission: privileged (admin/supervisor)
// Status gate: ทุกสถานะยกเว้น "รอจัดซื้อดำเนินการ" (ใช้ OrderForm) + "ยกเลิก"
// (สั่งซื้อแล้ว / กำลังขนส่ง / รับของแล้ว / มีปัญหา / เสร็จสมบูรณ์ แก้ได้หมด)
// ==================================================================
export interface EditPricesInput {
  itemPrices: number[];       // 1 ค่า per item ตามลำดับ items เดิม
  discount: number;
  shippingFee: number;
  vatRate: number;             // 0 หรือ 0.07
}

export async function updatePoPricesAction(
  poId: string,
  input: EditPricesInput,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  if (!poId) return { ok: false, error: "ข้อมูลไม่ครบ" };
  if (![0, 0.07].includes(input.vatRate)) {
    return { ok: false, error: "VAT rate ต้องเป็น 0 หรือ 0.07" };
  }
  if (input.discount < 0 || input.shippingFee < 0) {
    return { ok: false, error: "discount / shipping ต้อง ≥ 0" };
  }

  const sb = getSupabaseAdmin();
  const { data: po } = await sb
    .from("purchase_orders")
    .select("id, po_number, status, items, subtotal, total, deleted_at, created_by")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };
  if (po.deleted_at) {
    return { ok: false, error: "PO นี้อยู่ในถังขยะ — กู้คืนก่อน" };
  }
  const status = po.status as PoStatus;
  if (status === "รอจัดซื้อดำเนินการ") {
    return {
      ok: false,
      error: "สถานะนี้ให้แก้ผ่านปุ่ม \"สั่งซื้อ\" (OrderForm) แทน",
    };
  }
  if (status === "ยกเลิก") {
    return { ok: false, error: "PO ถูกยกเลิกแล้ว — แก้ไขไม่ได้" };
  }

  const items = (po.items ?? []) as PoItem[];
  if (input.itemPrices.length !== items.length) {
    console.error(
      `[po updatePoPrices] length mismatch — prices=${input.itemPrices.length} items=${items.length}`,
    );
    return {
      ok: false,
      error: `จำนวนราคาไม่ตรงกับ items (ส่ง ${input.itemPrices.length} vs DB มี ${items.length})`,
    };
  }

  // Coerce → Number (guard string/undefined จาก Server Action serialization)
  const numericPrices = input.itemPrices.map((p, i) => {
    const n = Number(p);
    if (!Number.isFinite(n) || n < 0) {
      return { valid: false as const, idx: i, raw: p };
    }
    return { valid: true as const, value: n };
  });
  const invalid = numericPrices.find((r) => !r.valid);
  if (invalid && !invalid.valid) {
    return {
      ok: false,
      error: `ราคาไม่ถูกต้อง (รายการที่ ${invalid.idx + 1}): "${String(invalid.raw)}"`,
    };
  }

  const oldTotal = po.total ?? 0;

  // สร้าง items ใหม่ — เก็บ qty เดิม, เปลี่ยนแค่ราคา
  const newItems: PoItem[] = items.map((it, idx) => {
    const priceEntry = numericPrices[idx];
    const newPrice = priceEntry.valid ? priceEntry.value : 0;
    const qty = it.qty ?? 0;
    return {
      ...it,
      unit_price: newPrice,
      subtotal: newPrice * qty,
    };
  });

  const subtotal = newItems.reduce((s, it) => s + (it.subtotal ?? 0), 0);
  const vat = subtotal * input.vatRate;
  const total = subtotal - input.discount + input.shippingFee + vat;

  console.log(
    `[po updatePoPrices] ENTER poId=${poId} items=${items.length} ` +
      `subtotal=${subtotal} discount=${input.discount} shipping=${input.shippingFee} ` +
      `vat=${vat} total=${total}`,
  );

  // .select() → return updated row เพื่อ verify save จริง
  const { data: updated, error } = await sb
    .from("purchase_orders")
    .update({
      items: newItems,
      subtotal,
      discount: input.discount,
      shipping_fee: input.shippingFee,
      vat,
      total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId)
    .select("id, po_number, subtotal, total")
    .maybeSingle();
  if (error) {
    console.error("[po updatePoPrices] UPDATE failed:", error);
    return { ok: false, error: `บันทึกไม่สำเร็จ: ${error.message ?? "unknown"}` };
  }
  if (!updated) {
    console.error(
      `[po updatePoPrices] UPDATE returned no row — id=${poId} may have moved to trash between fetch and update`,
    );
    return { ok: false, error: "บันทึกไม่สำเร็จ — ไม่พบ PO ที่จะแก้ (อาจถูกลบระหว่างนี้)" };
  }
  console.log(
    `[po updatePoPrices] OK — po=${(updated as { po_number?: string }).po_number} ` +
      `saved subtotal=${(updated as { subtotal?: number }).subtotal} ` +
      `total=${(updated as { total?: number }).total}`,
  );

  // อัปเดต last_cost ของ equipment ที่มีราคาใหม่ — parallel (กัน Vercel timeout)
  //   เดิมเป็น sequential loop → ถ้ามีหลาย items → หลาย round trips ต่อเนื่อง
  //   อาจใช้เวลานานจน Vercel function timeout ทำให้ response ไม่ถึง client
  //   แม้ DB save เสร็จแล้ว (log แสดง OK แต่ POST status = ---)
  const eqUpdates = newItems
    .filter((it) => it.equipment_id && (it.unit_price ?? 0) > 0)
    .map((it) =>
      sb
        .from("equipment")
        .update({ last_cost: it.unit_price })
        .eq("id", it.equipment_id!),
    );
  if (eqUpdates.length > 0) {
    // allSettled — ไม่ throw แม้บาง update fail (best-effort)
    await Promise.allSettled(eqUpdates);
  }

  const fmtMoney = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
  await logActivity(
    poId,
    user.full_name,
    user.role,
    "prices_edited",
    `แก้ราคา: ยอดรวม ฿${fmtMoney(oldTotal)} → ฿${fmtMoney(total)}` +
      ` (subtotal ฿${fmtMoney(subtotal)} + shipping ฿${fmtMoney(input.shippingFee)}` +
      ` - discount ฿${fmtMoney(input.discount)} + vat ฿${fmtMoney(vat)})`,
  );

  // Notify creator (in-app) — ราคาเปลี่ยน = ข้อมูลที่ creator ควรรู้
  //   ไม่ส่ง email (เป็น edit ไม่ใช่ status change) — เข้า /notifications แทน
  try {
    const poRow = po as { created_by: string | null; po_number: string };
    if (poRow.created_by && poRow.created_by !== user.id) {
      await sb.from("notifications").insert({
        user_id: poRow.created_by,
        po_id: poId,
        title: `💰 ${poRow.po_number} มีการแก้ราคา`,
        message: `ยอดรวม ฿${fmtMoney(oldTotal)} → ฿${fmtMoney(total)} โดย ${user.full_name}`,
      } as never);
    }
  } catch (e) {
    console.warn("[po updatePoPrices] notify failed:", e);
  }

  revalidatePath(`/po/${poId}`);
  revalidatePath("/po");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/budget");
  return { ok: true, poId };
}

export async function updateProcurementNotesAction(
  poId: string,
  notes: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  if (!poId) return { ok: false, error: "ข้อมูลไม่ครบ" };

  const trimmed = notes.trim();
  if (trimmed.length > 5000) {
    return { ok: false, error: "หมายเหตุยาวเกินไป (สูงสุด 5000 ตัวอักษร)" };
  }

  const sb = getSupabaseAdmin();
  const { data: po } = await sb
    .from("purchase_orders")
    .select("id, po_number, status, procurement_notes, deleted_at, created_by")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };
  if (po.deleted_at) {
    return { ok: false, error: "PO นี้อยู่ในถังขยะ — กู้คืนก่อน" };
  }
  if (po.status === "ยกเลิก") {
    return { ok: false, error: "แก้ไขหมายเหตุไม่ได้ — PO ถูกยกเลิกแล้ว" };
  }

  // Idempotent: ถ้าค่าเหมือนเดิมไม่ต้อง update
  const oldNotes = (po.procurement_notes ?? "").trim();
  if (oldNotes === trimmed) {
    return { ok: true, poId };
  }

  const { error } = await sb
    .from("purchase_orders")
    .update({
      procurement_notes: trimmed || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);
  if (error) {
    console.error("[po updateProcurementNotes] failed:", error);
    return { ok: false, error: "บันทึกไม่สำเร็จ" };
  }

  // Audit log — บันทึก diff อย่างย่อ (กัน description ยาวเกิน)
  const oldPreview = oldNotes.slice(0, 60) || "(ว่าง)";
  const newPreview = trimmed.slice(0, 60) || "(ว่าง)";
  await logActivity(
    poId,
    user.full_name,
    user.role,
    "procurement_notes_edited",
    `แก้ไขหมายเหตุจัดซื้อ: "${oldPreview}${oldNotes.length > 60 ? "…" : ""}" → "${newPreview}${trimmed.length > 60 ? "…" : ""}"`,
  );

  // Notify creator (in-app) — หมายเหตุจัดซื้ออาจกระทบการรับของ
  //   Privacy: ไม่ใส่เนื้อหา notes ในข้อความ (creator เข้าดูใน /po/[id])
  try {
    const poRow = po as { created_by: string | null; po_number: string };
    if (poRow.created_by && poRow.created_by !== user.id) {
      await sb.from("notifications").insert({
        user_id: poRow.created_by,
        po_id: poId,
        title: `📝 ${poRow.po_number} หมายเหตุจัดซื้อถูกแก้`,
        message: `โดย ${user.full_name} — ดูเนื้อหาที่หน้า PO`,
      } as never);
    }
  } catch (e) {
    console.warn("[po updateProcurementNotes] notify failed:", e);
  }

  revalidatePath(`/po/${poId}`);
  return { ok: true, poId };
}

// ==================================================================
// Set / change PO supplier (admin override) — แก้ Supplier ของ PO โดยตรง
//
// Use case: snapshot drift, ลิงก์ supplier ผิด, ต้องเปลี่ยน vendor หลังสั่งไปแล้ว
// Permission: privileged (admin/supervisor)
// Modes:
//   - supplierId provided → set supplier_id + sync supplier_name จาก table จริง
//   - supplierId = null + freeTextName provided → ตั้ง supplier_name + clear supplier_id
//   - ทั้งสอง null → reject
// ==================================================================
export async function setPoSupplierAction(
  poId: string,
  opts: { supplierId: string | null; freeTextName?: string },
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  if (!poId) return { ok: false, error: "ข้อมูลไม่ครบ" };

  const sb = getSupabaseAdmin();

  // ตรวจสอบ PO มีจริง + ไม่อยู่ในถังขยะ
  const { data: po } = await sb
    .from("purchase_orders")
    .select("id, po_number, status, supplier_name, supplier_id, deleted_at")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };
  if (po.deleted_at) {
    return { ok: false, error: "PO นี้อยู่ในถังขยะ — กู้คืนก่อน" };
  }
  if (po.status === "ยกเลิก") {
    return { ok: false, error: "PO ถูกยกเลิกแล้ว — แก้ไขไม่ได้" };
  }

  let newSupplierName: string;
  let newSupplierId: string | null = null;
  const oldName = po.supplier_name ?? "";
  const oldId = po.supplier_id;

  if (opts.supplierId) {
    // โหมด: link to existing supplier (exclude trashed)
    const { data: sup } = await sb
      .from("suppliers" as never)
      .select("id, name, is_active, deleted_at")
      .eq("id", opts.supplierId)
      .is("deleted_at", null)
      .maybeSingle();
    type SupRow = { id: string; name: string; is_active: boolean; deleted_at: string | null };
    const supRow = sup as SupRow | null;
    if (!supRow) return { ok: false, error: "ไม่พบ Supplier (หรืออยู่ในถังขยะ)" };
    newSupplierId = supRow.id;
    newSupplierName = supRow.name;
  } else {
    // โหมด: free-text (unlink + set ชื่อตามที่พิมพ์)
    const ft = (opts.freeTextName ?? "").trim();
    if (!ft) return { ok: false, error: "กรุณาระบุ Supplier" };
    if (ft.length > 120) return { ok: false, error: "ชื่อยาวเกินไป" };
    newSupplierId = null;
    newSupplierName = ft;
  }

  // Idempotent — ถ้าเหมือนเดิมไม่ต้อง update
  if (oldName === newSupplierName && oldId === newSupplierId) {
    return { ok: true, poId };
  }

  const { error } = await sb
    .from("purchase_orders")
    .update({
      supplier_id: newSupplierId,
      supplier_name: newSupplierName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);
  if (error) {
    console.error("[po setPoSupplier] failed:", error);
    return { ok: false, error: "บันทึกไม่สำเร็จ" };
  }

  await logActivity(
    poId,
    user.full_name,
    user.role,
    "supplier_changed",
    `เปลี่ยน Supplier: "${oldName || "(ว่าง)"}" → "${newSupplierName}"`,
  );

  console.log(
    `[po setPoSupplier] ${po.po_number}: "${oldName}" → "${newSupplierName}" (id: ${oldId} → ${newSupplierId})`,
  );

  revalidatePath(`/po/${poId}`);
  revalidatePath("/po");
  revalidatePath("/po/pending-receipt");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
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
  console.log(`[po createPoAction] ENTER — items=${items.length}`);
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };

  // Rate limit per user — gate accidental duplicate submits + abusive automation
  // (no-op if Upstash env vars aren't configured)
  const { checkRateLimit, CREATE_PO_LIMITER } = await import("@/lib/security/rate-limit");
  const rl = await checkRateLimit(CREATE_PO_LIMITER, `po:${user.id}`);
  if (!rl.allowed) {
    return { ok: false, error: rl.retryAfterText ?? "เกินจำนวนคำขอ" };
  }

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

  // Dedup: รวมแถวซ้ำ (equipment_id ตรง หรือ custom ที่ name+unit ตรง) ก่อนบันทึก
  // ก่อน: 2 แถวชื่อเดียวกัน → receive-form แยกไม่ออก, "รับแล้ว" total ผิด
  // หลัง: qty รวมกัน, notes ต่อกัน (คั่นด้วย " | "), image_urls รวมแล้ว dedup
  const mergedMap = new Map<string, PoItem>();
  for (const it of cleanItems) {
    // Key: prefer equipment_id (ของใน master), ตกเป็น name|unit (custom)
    const key = it.equipment_id
      ? `eq:${it.equipment_id}`
      : `n:${(it.name ?? "").trim().toLowerCase()}|${it.unit ?? ""}`;
    const existing = mergedMap.get(key);
    if (existing) {
      existing.qty += it.qty;
      if (it.notes && it.notes !== existing.notes) {
        existing.notes = [existing.notes, it.notes].filter(Boolean).join(" | ");
      }
      // Merge image URLs (dedup)
      const imgs = new Set([...(existing.image_urls ?? []), ...(it.image_urls ?? [])]);
      existing.image_urls = Array.from(imgs);
    } else {
      mergedMap.set(key, { ...it });
    }
  }
  const dedupedItems = Array.from(mergedMap.values());

  // Retry on duplicate po_number — กัน race ตอน RPC fallback ใช้
  let newPo: { id: string; po_number: string } | null = null;
  let lastErr: { code?: string; message?: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const poNumber = await generatePoNumber();
    const { data, error } = await sb
      .from("purchase_orders")
      .insert({
        po_number: poNumber,
        items: dedupedItems,
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
  //   ทำงานบน dedupedItems (สิ่งที่บันทึกจริง) — ไม่ใช่ cleanItems ก่อน dedup
  let anyLinked = false;
  for (let i = 0; i < dedupedItems.length; i++) {
    const it = dedupedItems[i];
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
        dedupedItems[i].equipment_id = pending.id;
        anyLinked = true;
      }
    }
  }
  if (anyLinked) {
    await sb
      .from("purchase_orders")
      .update({ items: dedupedItems })
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
        // กัน admin/supervisor ที่สร้าง PO เองรับ noti ของตัวเอง
        excludeUserId: user.id,
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
  /** Admin แก้ qty + ราคา ได้ที่ตำแหน่งเดียวกับ po.items
   *  qty: ถ้าไม่ส่งหรือเป็น undefined → ใช้ qty เดิม
   */
  itemUpdates: Array<{ qty: number; unit_price: number }>;
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
  console.log(`[po updateProcurementAction] ENTER — poId=${poId} supplier=${input.supplierName}`);
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  if (!input.supplierName.trim()) {
    return { ok: false, error: "กรุณากรอกชื่อ supplier" };
  }
  // Validate expected date — strict ISO YYYY-MM-DD format
  if (!input.expectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.expectedDate)) {
    return { ok: false, error: "วันที่คาดว่าจะได้รับ format ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)" };
  }
  const parsedDate = new Date(input.expectedDate + "T00:00:00.000Z");
  if (isNaN(parsedDate.getTime())) {
    return { ok: false, error: "วันที่ไม่ถูกต้อง (parse ไม่ได้)" };
  }

  const sb = getSupabaseAdmin();
  const { data: po } = await sb
    .from("purchase_orders")
    .select("*")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };
  if (po.deleted_at) {
    return { ok: false, error: "PO นี้อยู่ในถังขยะ — กู้คืนก่อน" };
  }

  const items = (po.items ?? []) as PoItem[];
  if (input.itemUpdates.length !== items.length) {
    return { ok: false, error: "จำนวน items ไม่ตรงกับฟอร์ม" };
  }

  // Validate qty — ห้าม 0 หรือติดลบ
  for (let i = 0; i < items.length; i++) {
    const newQty = Math.floor(input.itemUpdates[i]?.qty ?? 0);
    if (newQty < 1) {
      return {
        ok: false,
        error: `จำนวนของ "${items[i].name}" ต้อง ≥ 1`,
      };
    }
  }

  // Track qty changes for activity log
  const qtyChanges: string[] = [];

  // Build new items with updated qty + prices
  const newItems = items.map((it, idx) => {
    const update = input.itemUpdates[idx];
    const newQty = Math.max(1, Math.floor(update?.qty ?? it.qty ?? 1));
    const unitPrice = Math.max(0, update?.unit_price ?? 0);
    // ถ้า admin แก้ qty → log
    if (newQty !== (it.qty ?? 0)) {
      qtyChanges.push(`${it.name}: ${it.qty} → ${newQty}`);
    }
    return {
      ...it,
      qty: newQty,
      unit_price: unitPrice,
      subtotal: unitPrice * newQty,
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
  // ไม่ match suppliers ที่อยู่ในถังขยะ — เลี่ยง link ไปยัง supplier ที่ถูกลบ
  // Escape ILIKE wildcards (%, _) ในชื่อ user input — ไม่งั้นชื่อมี % จะ match ผิด
  let supplierId: string | null = null;
  const supplierName = input.supplierName.trim();
  if (supplierName) {
    const escaped = supplierName.replace(/\\/g, "\\\\").replace(/[%_]/g, "\\$&");
    const { data: matched } = await sb
      .from("suppliers" as never)
      .select("id")
      .ilike("name", escaped)
      .is("deleted_at", null)
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

  // Activity log — ใส่ qty changes ถ้ามี
  const qtyChangeNote = qtyChanges.length > 0
    ? ` | แก้จำนวน: ${qtyChanges.join(", ")}`
    : "";
  await logActivity(
    poId, user.full_name, user.role, "ordered",
    `สั่งกับ ${input.supplierName} | คาดว่าจะได้รับ ${input.expectedDate}${qtyChangeNote}`,
  );

  if (po.created_by) {
    try {
      await notifyUser(
        po.created_by, poId,
        `✅ ${po.po_number} สั่งซื้อแล้ว`,
        `คาดว่าจะได้รับ ${input.expectedDate}`,
        "po_status_change",
        {
          poNumber: po.po_number,
          emailKind: "ordered",
          by: user.full_name,
          // Note: ไม่ส่ง supplierName ไปยัง email — อยากให้แจ้งแค่ "สั่งซื้อแล้ว"
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
  if (po.deleted_at) {
    return { ok: false, error: "PO นี้อยู่ในถังขยะ — กู้คืนก่อน" };
  }

  // Permission: creator OR privileged (admin/supervisor)
  //   ก่อน: ทุก user รับของบน PO ใดก็ได้ → staff คนอื่นยัน stock ปลอมได้
  //         (สร้าง PO ปลอม + รับของ = inject stock; หรือรับของแทนคนอื่นเพื่อปกปิด)
  //   หลัง: เฉพาะคนที่สร้าง PO หรือแอดมิน — audit trail สอดคล้อง
  const isPrivileged = user.role === "admin" || user.role === "supervisor";
  if (!isPrivileged && po.created_by !== user.id) {
    return {
      ok: false,
      error: "คุณไม่ใช่เจ้าของ PO นี้ — เฉพาะเจ้าของ PO หรือแอดมินรับของได้",
    };
  }

  // Workflow gate: รับของได้เมื่อสถานะอยู่ในช่วงรับ
  //  - "กำลังขนส่ง"  → รับครั้งแรก
  //  - "รับของแล้ว"  → supplier ส่งของแยกหลายรอบ — รับเพิ่มได้ (multi-delivery)
  //  - "มีปัญหา"      → ของยังมาไม่ครบ/เสีย → รับเพิ่มเพื่อ resolve ได้
  // (ต้องผ่านขั้น "สั่งซื้อแล้ว" → "กำลังขนส่ง" ก่อน admin อัปเดตขนส่ง
  //  จากนั้น ใครก็ได้ถึงจะกดรับของได้)
  const RECEIVABLE_STATUSES: PoStatus[] = ["กำลังขนส่ง", "รับของแล้ว", "มีปัญหา"];
  if (!RECEIVABLE_STATUSES.includes(po.status as PoStatus)) {
    const hint = po.status === "สั่งซื้อแล้ว"
      ? "รอแอดมินอัปเดตสถานะขนส่งก่อน"
      : po.status === "เสร็จสมบูรณ์"
        ? "PO ถูกปิดงานแล้ว — เปิดใหม่ไม่ได้"
        : po.status === "ยกเลิก"
          ? "PO ถูกยกเลิกแล้ว"
          : `สถานะปัจจุบัน: ${po.status}`;
    return {
      ok: false,
      error: `ยังกดรับของไม่ได้ — ${hint}`,
    };
  }

  // Validation: qty_damaged ห้ามมากกว่า qty_received
  for (const it of input.itemsReceived) {
    const received = Math.floor(it.qty_received ?? 0);
    const damaged = Math.floor(it.qty_damaged ?? 0);
    if (damaged > received) {
      return {
        ok: false,
        error: `จำนวนเสียหายของ "${it.name}" (${damaged}) มากกว่าจำนวนที่ได้รับ (${received}) ไม่ได้`,
      };
    }
    if (received < 0 || damaged < 0) {
      return {
        ok: false,
        error: `จำนวนของ "${it.name}" ติดลบไม่ได้`,
      };
    }
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
        .update({
          stock: cur + qty,
          updated_at: new Date().toISOString(),
        })
        .eq("id", it.equipment_id);
    }
    stockUpdatedCount++;
  }

  // Phase E: สร้าง lot อัตโนมัติ (best-effort — ไม่ block flow ถ้า lots table ยังไม่ migrate)
  if (insertedDeliveryId) {
    try {
      // ดึง equipment unit ไปด้วย (ไม่งั้น lots.unit เป็น null)
      const eqIds = Array.from(
        new Set(
          input.itemsReceived
            .map((it) => it.equipment_id)
            .filter((id): id is string => !!id),
        ),
      );
      const unitMap = new Map<string, string>();
      if (eqIds.length > 0) {
        const { data: equipments } = await sb
          .from("equipment")
          .select("id, unit")
          .in("id", eqIds);
        for (const eq of ((equipments ?? []) as Array<{ id: string; unit: string | null }>)) {
          if (eq.unit) unitMap.set(eq.id, eq.unit);
        }
      }

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
          unit: it.equipment_id ? unitMap.get(it.equipment_id) : undefined,
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
