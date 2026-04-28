import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/require-user";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { SettingsClient, type CompanySettings } from "./_components/settings-client";

export const metadata: Metadata = {
  title: "ตั้งค่า — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

async function getCompanySettings(): Promise<CompanySettings> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("company_settings" as never)
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  const row = (data ?? {}) as Partial<CompanySettings>;
  return {
    name: row.name ?? "Lab Parfumo",
    name_th: row.name_th ?? "",
    address: row.address ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    tax_id: row.tax_id ?? "",
    website: row.website ?? "",
    login_intro_visible: row.login_intro_visible ?? true,
    login_intro_title: row.login_intro_title ?? "ℹ️ บัญชีเริ่มต้น",
    login_intro_text: row.login_intro_text ?? "",
    login_intro_note: row.login_intro_note ?? "",
    updated_at: row.updated_at ?? "",
    updated_by_name: row.updated_by_name ?? "",
  };
}

export default async function SettingsPage() {
  await requireAdmin();
  const settings = await getCompanySettings();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ตั้งค่าระบบ</h1>
        <p className="text-sm text-slate-500">
          ข้อมูลบริษัท + ข้อความหน้า Login
        </p>
      </div>
      <SettingsClient initial={settings} />
    </div>
  );
}
