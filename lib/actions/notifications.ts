"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";

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
