"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  invalidateEmailTransporter, sendEmail, verifyEmail,
  type SendResult,
} from "@/lib/email";
import { encryptSecret } from "@/lib/crypto/secrets";

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

// ==================================================================
// Email/SMTP settings
// ==================================================================
export interface EmailSettingsInput {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  /** ถ้าเป็น empty string → คงค่าเดิมไว้ (ไม่อัปเดต password) */
  smtp_password: string;
  smtp_from_email: string;
  smtp_from_name: string;
  smtp_secure: boolean;
}

export async function updateEmailSettingsAction(
  input: EmailSettingsInput,
): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentUser();
  if (!me || me.role !== "admin") {
    return { ok: false, error: "เฉพาะแอดมิน" };
  }

  // Validate
  if (input.smtp_host && (!input.smtp_user || !input.smtp_from_email)) {
    return { ok: false, error: "กรุณาระบุ Username และ From email" };
  }
  if (input.smtp_port < 1 || input.smtp_port > 65535) {
    return { ok: false, error: "Port ไม่ถูกต้อง (1-65535)" };
  }

  const sb = getSupabaseAdmin();
  const payload: Record<string, unknown> = {
    id: 1,
    smtp_host: input.smtp_host.trim(),
    smtp_port: input.smtp_port,
    smtp_user: input.smtp_user.trim(),
    smtp_from_email: input.smtp_from_email.trim(),
    smtp_from_name: input.smtp_from_name.trim(),
    smtp_secure: input.smtp_secure,
    updated_at: new Date().toISOString(),
    updated_by_name: me.full_name,
  };
  // อัปเดต password เฉพาะเมื่อ user กรอกใหม่ — encrypt ก่อนเก็บ DB
  // ถ้าไม่มี ENCRYPTION_KEY ใน env → encryptSecret() return plaintext (degraded)
  if (input.smtp_password) {
    payload.smtp_password = encryptSecret(input.smtp_password);
  }

  const { error } = await sb
    .from("company_settings" as never)
    .upsert(payload as never);
  if (error) {
    console.error("[email-settings] update failed:", error);
    return { ok: false, error: "บันทึกไม่สำเร็จ" };
  }

  // ล้าง cache transporter — ครั้งหน้าจะอ่านค่าใหม่
  invalidateEmailTransporter();
  revalidatePath("/settings");
  return { ok: true };
}

export async function clearEmailSettingsAction(): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentUser();
  if (!me || me.role !== "admin") {
    return { ok: false, error: "เฉพาะแอดมิน" };
  }
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("company_settings" as never)
    .upsert({
      id: 1,
      smtp_host: "",
      smtp_user: "",
      smtp_password: "",
      smtp_from_email: "",
      smtp_from_name: "",
      smtp_secure: false,
      updated_at: new Date().toISOString(),
      updated_by_name: me.full_name,
    } as never);
  if (error) return { ok: false, error: "ล้างค่าไม่สำเร็จ" };
  invalidateEmailTransporter();
  revalidatePath("/settings");
  return { ok: true };
}

/**
 * ตรวจสอบการเชื่อมต่อ SMTP โดยไม่ส่งอีเมลจริง (verify only)
 * — เร็วกว่า test send เพราะแค่ TCP handshake + AUTH
 */
export async function verifyEmailAction(): Promise<SendResult> {
  const me = await getCurrentUser();
  if (!me || me.role !== "admin") {
    return { ok: false, error: "เฉพาะแอดมิน" };
  }
  return verifyEmail();
}

export async function testEmailAction(
  toEmail: string,
): Promise<SendResult> {
  const me = await getCurrentUser();
  if (!me || me.role !== "admin") {
    return { ok: false, error: "เฉพาะแอดมิน" };
  }
  const target = (toEmail || "").trim();
  if (!target || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) {
    return { ok: false, error: "อีเมลไม่ถูกต้อง" };
  }

  const subject = "✅ ทดสอบส่งอีเมล — Lab Parfumo PO Pro";
  const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Sarabun',-apple-system,sans-serif;color:#1E293B;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F8FAFC;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="540" style="max-width:540px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 12px rgba(15,23,42,0.08);">
        <tr><td style="background:linear-gradient(135deg,#10B981,#047857);padding:24px;text-align:center;">
          <div style="width:48px;height:48px;background:rgba(255,255,255,0.18);border-radius:12px;display:inline-block;line-height:48px;font-size:24px;">✅</div>
          <h1 style="color:#fff;margin:10px 0 4px;font-size:18px;">SMTP ทำงานปกติ</h1>
          <p style="color:#A7F3D0;margin:0;font-size:12px;">Lab Parfumo PO Pro</p>
        </td></tr>
        <tr><td style="padding:22px 24px;font-size:14px;color:#334155;line-height:1.6;">
          <p style="margin:0 0 10px;">สวัสดี <strong>${escHtml(me.full_name)}</strong>,</p>
          <p style="margin:0 0 12px;">นี่คืออีเมลทดสอบจากระบบ — ถ้าคุณได้รับอีเมลฉบับนี้ แปลว่า SMTP ของคุณตั้งค่าถูกต้องแล้ว 🎉</p>
          <div style="background:#ECFDF5;border-left:4px solid #10B981;padding:10px 14px;border-radius:0 8px 8px 0;font-size:13px;color:#065F46;">
            ระบบจะใช้ SMTP นี้ส่งอีเมล:<br>
            • อีเมลต้อนรับเมื่อสร้างผู้ใช้ใหม่<br>
            • Daily digest สรุปยอดประจำวัน
          </div>
          <p style="margin:14px 0 0;font-size:12px;color:#64748B;">
            ส่งจาก: ${escHtml(me.full_name)} • เวลา: ${new Date().toLocaleString("th-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = `✅ SMTP ทำงานปกติ — Lab Parfumo PO Pro

สวัสดี ${me.full_name},

นี่คืออีเมลทดสอบจากระบบ — ถ้าคุณได้รับอีเมลฉบับนี้
แปลว่า SMTP ของคุณตั้งค่าถูกต้องแล้ว

ระบบจะใช้ SMTP นี้ส่งอีเมล:
- อีเมลต้อนรับเมื่อสร้างผู้ใช้ใหม่
- Daily digest สรุปยอดประจำวัน

เวลา: ${new Date().toLocaleString("th-TH")}
`;

  const r = await sendEmail({ to: target, subject, html, text });
  return r;
}

function escHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
