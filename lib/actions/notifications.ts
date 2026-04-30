"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
} from "@/lib/types/db";

export async function markNotificationReadAction(notifId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const sb = getSupabaseAdmin();
  await sb.from("notifications").update({ is_read: true })
    .eq("id", notifId).eq("user_id", user.id);
  revalidatePath("/notifications");
}

export async function markAllReadAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const sb = getSupabaseAdmin();
  await sb.from("notifications").update({ is_read: true })
    .eq("user_id", user.id).eq("is_read", false);
  revalidatePath("/notifications");
}

// ==================================================================
// Notification preferences (Phase B)
// ==================================================================

/**
 * อัปเดต notification preferences ของตัวเอง
 * Sanitize: เฉพาะ keys ที่อยู่ใน NotificationPrefs และเป็น boolean
 */
export async function updateMyPrefsAction(
  prefs: Partial<NotificationPrefs>,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };

  // Whitelist + coerce — กัน injection
  const allowed: (keyof NotificationPrefs)[] = [
    "email_daily_digest",
    "email_po_status_change",
    "inapp_po_status_change",
    "inapp_po_cancelled",
    "inapp_new_po",
  ];
  const merged: NotificationPrefs = { ...DEFAULT_NOTIFICATION_PREFS };
  for (const k of allowed) {
    const v = prefs[k];
    if (typeof v === "boolean") merged[k] = v;
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("users")
    .update({ notification_prefs: merged } as never)
    .eq("id", user.id);
  if (error) return { ok: false, error: "บันทึกไม่สำเร็จ" };

  revalidatePath("/preferences");
  return { ok: true };
}
