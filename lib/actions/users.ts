"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { hashBcrypt, validatePassword } from "@/lib/auth/password";
import { sendWelcomeEmail } from "@/lib/email";
import {
  createUserSchema, updateUserSchema, formatZodError,
} from "./schemas";

interface ActionResult {
  ok: boolean;
  error?: string;
  userId?: string;
  emailSent?: boolean;
  emailError?: string;
}

const ROLE_LABEL = { admin: "แอดมิน + จัดซื้อ", requester: "Staff" } as const;

export async function createUserAction(input: {
  username: string;
  password: string;
  fullName: string;
  role: "admin" | "requester";
  email?: string;
  sendEmail?: boolean;
}): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me || me.role !== "admin") {
    return { ok: false, error: "เฉพาะแอดมิน" };
  }

  // Validate input schema first
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }
  const username = parsed.data.username;

  // Stricter password rules (length + complexity vs username)
  const v = validatePassword(input.password, username);
  if (!v.ok) return { ok: false, error: v.message };

  const sb = getSupabaseAdmin();
  const hash = await hashBcrypt(input.password);
  const { data, error } = await sb
    .from("users")
    .insert({
      username,
      password_hash: hash,
      full_name: input.fullName.trim(),
      role: input.role,
      email: input.email?.trim() ?? "",
      must_change_password: true,
      is_active: true,
    })
    .select()
    .maybeSingle();
  if (error || !data) {
    if (String(error?.message ?? "").toLowerCase().includes("duplicate")) {
      return { ok: false, error: "Username นี้มีอยู่แล้ว" };
    }
    return { ok: false, error: "เพิ่มผู้ใช้ไม่สำเร็จ" };
  }

  // Send welcome email (best-effort)
  let emailSent = false;
  let emailError: string | undefined;
  if (input.sendEmail !== false && input.email?.trim()) {
    try {
      // Get company name from settings
      const { data: company } = await sb
        .from("company_settings" as never)
        .select("name, name_th")
        .eq("id", 1)
        .maybeSingle();
      const companyName =
        (company as { name_th?: string; name?: string } | null)?.name_th ||
        (company as { name_th?: string; name?: string } | null)?.name ||
        "Lab Parfumo";

      const r = await sendWelcomeEmail({
        email: input.email.trim(),
        fullName: input.fullName.trim(),
        username,
        temporaryPassword: input.password,
        roleLabel: ROLE_LABEL[input.role],
        companyName,
      });
      emailSent = r.ok;
      if (!r.ok) emailError = r.error;
    } catch (e) {
      emailError = e instanceof Error ? e.message : String(e);
    }
  }

  revalidatePath("/users");
  return { ok: true, userId: data.id, emailSent, emailError };
}

export async function updateUserAction(
  userId: string, input: {
    fullName?: string;
    email?: string;
    role?: "admin" | "requester";
    isActive?: boolean;
    newPassword?: string;
  },
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me || me.role !== "admin") {
    return { ok: false, error: "เฉพาะแอดมิน" };
  }

  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }

  const sb = getSupabaseAdmin();
  const update: Record<string, unknown> = {};
  if (input.fullName !== undefined) update.full_name = input.fullName.trim();
  if (input.email !== undefined) update.email = input.email.trim();
  if (input.role !== undefined) update.role = input.role;
  if (input.isActive !== undefined) update.is_active = input.isActive;

  if (input.newPassword) {
    // ดึง username ก่อน เพื่อ validate
    const { data: u } = await sb
      .from("users")
      .select("username")
      .eq("id", userId)
      .maybeSingle();
    const v = validatePassword(input.newPassword, u?.username ?? "");
    if (!v.ok) return { ok: false, error: v.message };
    update.password_hash = await hashBcrypt(input.newPassword);
    update.must_change_password = true;  // บังคับเปลี่ยนใหม่หลัง admin reset
    update.password_changed_at = new Date().toISOString();
  }

  const { error } = await sb.from("users").update(update).eq("id", userId);
  if (error) return { ok: false, error: "บันทึกไม่สำเร็จ" };

  revalidatePath("/users");
  return { ok: true, userId };
}

export async function deleteUserAction(userId: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me || me.role !== "admin") {
    return { ok: false, error: "เฉพาะแอดมิน" };
  }
  if (userId === me.id) {
    return { ok: false, error: "ลบตัวเองไม่ได้" };
  }
  const sb = getSupabaseAdmin();
  // soft delete + invalidate sessions
  await sb.from("user_sessions").delete().eq("user_id", userId);
  const { error } = await sb
    .from("users")
    .update({
      is_active: false,
      username: `_del_${userId.slice(0, 8)}_${Date.now()}`,
    })
    .eq("id", userId);
  if (error) return { ok: false, error: "ลบไม่สำเร็จ" };
  revalidatePath("/users");
  return { ok: true };
}
