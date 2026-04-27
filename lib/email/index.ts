/**
 * Email sender — SMTP via nodemailer
 *
 * Env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
 *   FROM_EMAIL, FROM_NAME
 *
 * ถ้าไม่ตั้ง — function จะ no-op (return ok=false silently)
 */
import nodemailer from "nodemailer";

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) return null;

  _transporter = nodemailer.createTransport({
    host, port,
    secure: port === 465,
    auth: { user, pass },
  });
  return _transporter;
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendResult> {
  const t = getTransporter();
  if (!t) {
    return { ok: false, error: "SMTP not configured" };
  }
  const fromName = process.env.FROM_NAME ?? "Lab Parfumo PO";
  const fromEmail = process.env.FROM_EMAIL ?? process.env.SMTP_USER ?? "noreply@example.com";

  try {
    await t.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return { ok: true };
  } catch (e) {
    console.error("[email] send failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

// ==================================================================
// Welcome email — สำหรับ user ใหม่
// ==================================================================
export async function sendWelcomeEmail(opts: {
  email: string;
  fullName: string;
  username: string;
  temporaryPassword: string;
  roleLabel: string;
  companyName: string;
  loginUrl?: string;
}): Promise<SendResult> {
  const url = opts.loginUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000/login";
  const subject = `🔐 บัญชีใหม่ใน ${opts.companyName} — เริ่มใช้งาน Lab Parfumo PO Pro`;

  const html = `<!doctype html>
<html lang="th">
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; background:#F8FAFC; font-family:'Sarabun',-apple-system,sans-serif; color:#1E293B;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F8FAFC; padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 12px rgba(15,23,42,0.08);">
        <tr><td style="background:linear-gradient(135deg,#3A5A8C,#1E3A5F); padding:32px 24px; text-align:center;">
          <div style="width:56px; height:56px; background:rgba(255,255,255,0.15); border-radius:14px; display:inline-block; line-height:56px; font-size:28px;">📦</div>
          <h1 style="color:#fff; margin:14px 0 4px; font-size:22px;">ยินดีต้อนรับสู่ Lab Parfumo PO Pro</h1>
          <p style="color:#A8C0E0; margin:0; font-size:13px;">${escHtml(opts.companyName)}</p>
        </td></tr>
        <tr><td style="padding:28px 28px 8px;">
          <p style="font-size:15px; margin:0 0 8px;">สวัสดี <strong>${escHtml(opts.fullName)}</strong>,</p>
          <p style="font-size:14px; line-height:1.6; color:#475569; margin:0 0 16px;">
            แอดมินสร้างบัญชีให้คุณใช้งานระบบ Purchase Order แล้ว — กรุณา login ด้วยข้อมูลด้านล่าง
            <strong>ระบบจะบังคับให้ตั้งรหัสผ่านใหม่ตอน login ครั้งแรก</strong>
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F4F7FB; border:1px solid #E2E8F0; border-radius:12px; padding:16px; margin:16px 0;">
            <tr><td style="padding:6px 8px; color:#64748B; font-size:12px;">Username</td>
                <td style="padding:6px 8px; font-weight:bold; font-family:monospace;">${escHtml(opts.username)}</td></tr>
            <tr><td style="padding:6px 8px; color:#64748B; font-size:12px;">รหัสผ่านชั่วคราว</td>
                <td style="padding:6px 8px; font-weight:bold; font-family:monospace; color:#3A5A8C;">${escHtml(opts.temporaryPassword)}</td></tr>
            <tr><td style="padding:6px 8px; color:#64748B; font-size:12px;">บทบาท</td>
                <td style="padding:6px 8px;">${escHtml(opts.roleLabel)}</td></tr>
          </table>

          <p style="text-align:center; margin:24px 0;">
            <a href="${url}" style="display:inline-block; background:linear-gradient(135deg,#4A6FA5,#2E4D78); color:#fff; padding:12px 32px; border-radius:10px; text-decoration:none; font-weight:bold;">
              🚀 เข้าสู่ระบบ
            </a>
          </p>

          <div style="background:#FFFBEB; border-left:4px solid #D97706; padding:10px 14px; border-radius:0 8px 8px 0; font-size:13px; color:#451A03;">
            ⚠️ <strong>เพื่อความปลอดภัย:</strong> เปลี่ยนรหัสผ่านทันทีเมื่อ login — รหัสนี้ส่งทาง email อย่าแชร์
          </div>
        </td></tr>
        <tr><td style="padding:14px 28px 24px; text-align:center; color:#94A3B8; font-size:11px;">
          อีเมลนี้ส่งจากระบบ — กรุณาอย่าตอบกลับ
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = `ยินดีต้อนรับสู่ Lab Parfumo PO Pro — ${opts.companyName}

สวัสดี ${opts.fullName},

แอดมินสร้างบัญชีให้คุณใช้งาน — login ด้วยข้อมูลด้านล่าง:

Username: ${opts.username}
รหัสผ่านชั่วคราว: ${opts.temporaryPassword}
บทบาท: ${opts.roleLabel}

เข้าสู่ระบบ: ${url}

⚠️ เปลี่ยนรหัสทันทีเมื่อ login ครั้งแรก
`;

  return sendEmail({ to: opts.email, subject, html, text });
}

function escHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
