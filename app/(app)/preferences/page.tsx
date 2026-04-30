import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require-user";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from "@/lib/types/db";
import { PreferencesClient } from "./_components/preferences-client";

export const metadata: Metadata = {
  title: "การตั้งค่าส่วนตัว — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const me = await requireUser();
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("users")
    .select("notification_prefs")
    .eq("id", me.id)
    .maybeSingle();

  const prefs: NotificationPrefs = {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...((data as { notification_prefs: Partial<NotificationPrefs> | null } | null)
      ?.notification_prefs ?? {}),
  };

  const isPrivileged = me.role === "admin" || me.role === "supervisor";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">การแจ้งเตือนของฉัน</h1>
        <p className="text-sm text-slate-500">
          เลือกประเภทการแจ้งเตือนที่ต้องการรับ — ตั้งค่าเฉพาะตัวคุณเอง
        </p>
      </div>
      <PreferencesClient initial={prefs} isPrivileged={isPrivileged} />
    </div>
  );
}
