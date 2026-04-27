"use server";

import { redirect } from "next/navigation";
import { loginWithPassword } from "@/lib/auth/login";
import { createSession, setSessionCookie } from "@/lib/auth/session";

export interface LoginActionState {
  error?: string;
  attemptsRemaining?: number;
}

export async function loginAction(
  _prev: LoginActionState | null,
  formData: FormData,
): Promise<LoginActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const result = await loginWithPassword(username, password);
  if (!result.ok || !result.user) {
    return {
      error: result.error ?? "เข้าสู่ระบบไม่สำเร็จ",
      attemptsRemaining: result.attemptsRemaining,
    };
  }

  const token = await createSession(result.user.id);
  await setSessionCookie(token);

  // ถ้า user ต้องเปลี่ยนรหัสครั้งแรก → /change-password
  if (result.user.must_change_password) {
    redirect("/change-password");
  }
  redirect("/dashboard");
}
