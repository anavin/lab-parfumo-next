"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";

interface CompanyUpdateInput {
  name?: string;
  name_th?: string;
  address?: string;
  phone?: string;
  email?: string;
  tax_id?: string;
  website?: string;
  login_intro_visible?: boolean;
  login_intro_title?: string;
  login_intro_text?: string;
  login_intro_note?: string;
}

export async function updateCompanySettingsAction(
  input: CompanyUpdateInput,
): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentUser();
  if (!me || me.role !== "admin") {
    return { ok: false, error: "เฉพาะแอดมิน" };
  }

  const sb = getSupabaseAdmin();
  const allowed = [
    "name", "name_th", "address", "phone", "email", "tax_id", "website",
    "login_intro_visible", "login_intro_title", "login_intro_text", "login_intro_note",
  ] as const;

  const payload: Record<string, unknown> = {
    id: 1,
    updated_at: new Date().toISOString(),
    updated_by_name: me.full_name,
  };
  for (const k of allowed) {
    if (input[k] !== undefined) payload[k] = input[k];
  }

  const { error } = await sb.from("company_settings" as never).upsert(payload as never);
  if (error) {
    console.error("[settings] update failed:", error);
    return { ok: false, error: "บันทึกไม่สำเร็จ" };
  }
  revalidatePath("/settings");
  revalidatePath("/login");
  return { ok: true };
}
