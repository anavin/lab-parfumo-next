"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hashBcrypt, validatePassword } from "@/lib/auth/password";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export interface ChangePasswordState {
  error?: string;
}

export async function changePasswordAction(
  _prev: ChangePasswordState | null,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Session หมดอายุ — กรุณา login ใหม่" };
  }

  const newPwd = String(formData.get("new_password") ?? "");
  const confirmPwd = String(formData.get("confirm_password") ?? "");

  if (!newPwd || !confirmPwd) {
    return { error: "กรุณากรอกครบทั้ง 2 ช่อง" };
  }
  if (newPwd !== confirmPwd) {
    return { error: "รหัสผ่านยืนยันไม่ตรงกัน" };
  }
  const v = validatePassword(newPwd, user.username);
  if (!v.ok) {
    return { error: v.message };
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("users")
    .update({
      password_hash: await hashBcrypt(newPwd),
      must_change_password: false,
      password_changed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { error: "บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง" };
  }

  redirect("/dashboard");
}
