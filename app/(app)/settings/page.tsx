import type { Metadata } from "next";
import { requirePrivileged } from "@/lib/auth/require-user";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getEmailSettingsForUi } from "@/lib/db/email-settings";
import { getLookupsWithUsage } from "@/lib/db/lookups";
import type { LookupWithUsage } from "@/lib/types/db";
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
  const me = await requirePrivileged();
  const isAdmin = me.role === "admin";

  // Lookups: supervisor + admin เห็นได้
  // Company/Login/Email: admin เท่านั้น (ส่ง stub สำหรับ supervisor)
  const [settings, emailSettings, supplierCategories, banks, equipmentUnits, paymentTerms, withdrawalPurposes] = await Promise.all([
    isAdmin ? getCompanySettings() : Promise.resolve(null),
    isAdmin ? getEmailSettingsForUi() : Promise.resolve(null),
    getLookupsWithUsage("supplier_category"),
    getLookupsWithUsage("bank"),
    getLookupsWithUsage("equipment_unit"),
    getLookupsWithUsage("payment_term"),
    getLookupsWithUsage("withdrawal_purpose"),
  ]);

  const lookupsByType: Record<string, LookupWithUsage[]> = {
    supplier_category: supplierCategories,
    bank: banks,
    equipment_unit: equipmentUnits,
    payment_term: paymentTerms,
    withdrawal_purpose: withdrawalPurposes,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ตั้งค่าระบบ</h1>
        <p className="text-sm text-slate-500">
          {isAdmin
            ? "ข้อมูลบริษัท • หน้า Login • อีเมล • Lookups"
            : "Lookups (จัดการ dropdown)"
          }
        </p>
      </div>
      <SettingsClient
        initial={settings}
        email={emailSettings}
        adminEmail={me.email ?? ""}
        lookupsByType={lookupsByType}
        isAdmin={isAdmin}
      />
    </div>
  );
}
