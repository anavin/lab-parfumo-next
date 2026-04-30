/**
 * Email sender — SMTP via nodemailer
 *
 * Config sources (in priority order):
 *   1) Env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD,
 *                FROM_EMAIL, FROM_NAME
 *   2) DB: company_settings.smtp_*  (admin ตั้งผ่าน UI)
 *
 * ถ้าไม่มีทั้งคู่ — function return ok=false (ไม่ส่ง)
 *
 * Cache: transporter ถูก cache ตาม config string เพื่อให้
 * เปลี่ยน config ใน UI แล้วใช้ได้ทันที (ไม่ต้อง restart)
 */
import nodemailer from "nodemailer";
import { getEmailSettings } from "@/lib/db/email-settings";

interface CachedTransporter {
  key: string;
  transporter: nodemailer.Transporter;
}
let _cached: CachedTransporter | null = null;

type ConfigStatus =
  | { ok: true; transporter: nodemailer.Transporter; fromEmail: string; fromName: string }
  | { ok: false; reason: "not-configured" | "migration-needed" | "db-error"; detail?: string };

async function getTransporter(): Promise<ConfigStatus> {
  const s = await getEmailSettings();
  if (s.source === "migration-needed") {
    return { ok: false, reason: "migration-needed", detail: s.errorDetail };
  }
  if (s.source === "db-error") {
    return { ok: false, reason: "db-error", detail: s.errorDetail };
  }
  if (s.source === "none") {
    return { ok: false, reason: "not-configured" };
  }

  // cache key: ถ้า config เปลี่ยน จะสร้าง transporter ใหม่
  const key = `${s.host}:${s.port}:${s.user}:${s.password}:${s.secure}`;
  if (_cached && _cached.key === key) {
    return {
      ok: true,
      transporter: _cached.transporter,
      fromEmail: s.fromEmail,
      fromName: s.fromName,
    };
  }

  const transporter = nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: { user: s.user, pass: s.password },
    // timeout เร็วขึ้น เพื่อให้ test send ไม่รอนาน (default 10 นาที)
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  _cached = { key, transporter };
  return { ok: true, transporter, fromEmail: s.fromEmail, fromName: s.fromName };
}

/** ล้าง cache (เรียกเมื่อ admin บันทึก config ใหม่) */
export function invalidateEmailTransporter() {
  _cached = null;
}

export interface SendResult {
  ok: boolean;
  /** error message ที่ user จะเห็น (translated) */
  error?: string;
  /** technical detail สำหรับ log */
  errorDetail?: string;
  /** category ของ error เพื่อให้ UI แสดง troubleshoot ได้ตรงประเด็น */
  errorKind?:
    | "not-configured"
    | "migration-needed"
    | "db-error"
    | "auth"          // login ผิด (Gmail App Password / API Key)
    | "connect"       // network/host ผิด
    | "from"          // From email ถูก reject (ปกติของ Gmail)
    | "send"          // อื่นๆ
    ;
}

/**
 * แปลง error ของ nodemailer เป็น category + ข้อความภาษาไทย
 */
function categorizeSmtpError(e: unknown): {
  kind: NonNullable<SendResult["errorKind"]>;
  message: string;
  detail: string;
} {
  const detail = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: string })?.code ?? "";
  const responseCode = (e as { responseCode?: number })?.responseCode ?? 0;
  const lower = detail.toLowerCase();

  // Auth failures
  if (
    code === "EAUTH" ||
    responseCode === 535 || responseCode === 534 || responseCode === 530 ||
    /invalid login|authentication failed|username and password not accepted|535/.test(lower)
  ) {
    return {
      kind: "auth",
      message: "Username/Password ไม่ถูกต้อง — ตรวจสอบ App Password (Gmail) หรือ API Key",
      detail,
    };
  }
  // Connection failures
  if (
    code === "ECONNECTION" || code === "ETIMEDOUT" || code === "ECONNREFUSED" ||
    code === "ENOTFOUND" || code === "EDNS" ||
    /timeout|timed out|connection|getaddrinfo|enotfound/.test(lower)
  ) {
    return {
      kind: "connect",
      message: "เชื่อมต่อ SMTP server ไม่ได้ — ตรวจ Host/Port หรือ network",
      detail,
    };
  }
  // From envelope rejected
  if (
    /from .*not accepted|sender .*rejected|550|553|554/.test(lower) ||
    responseCode === 550 || responseCode === 553 || responseCode === 554
  ) {
    return {
      kind: "from",
      message: "From email ถูก server ปฏิเสธ — ตรวจให้ตรงกับ Username (Gmail บังคับ)",
      detail,
    };
  }
  return {
    kind: "send",
    message: `ส่งไม่สำเร็จ: ${detail}`,
    detail,
  };
}

function reasonToResult(reason: "not-configured" | "migration-needed" | "db-error", detail?: string): SendResult {
  if (reason === "migration-needed") {
    return {
      ok: false,
      errorKind: "migration-needed",
      error: "DB ยังไม่พร้อม — ต้องรัน migration `202604_email_settings.sql` ใน Supabase ก่อน",
      errorDetail: detail,
    };
  }
  if (reason === "db-error") {
    return {
      ok: false,
      errorKind: "db-error",
      error: "อ่าน config จาก DB ไม่ได้ — ตรวจ Supabase connection",
      errorDetail: detail,
    };
  }
  return {
    ok: false,
    errorKind: "not-configured",
    error: "ยังไม่ได้ตั้งค่า SMTP — ไปที่หน้าตั้งค่าก่อน",
  };
}

/**
 * ตรวจ SMTP โดยไม่ส่งอีเมลจริง (ใช้ `transporter.verify()`)
 * เหมาะสำหรับปุ่ม "ตรวจสอบการเชื่อมต่อ" ใน UI
 */
export async function verifyEmail(): Promise<SendResult> {
  const t = await getTransporter();
  if (!t.ok) return reasonToResult(t.reason, t.detail);

  try {
    await t.transporter.verify();
    return { ok: true };
  } catch (e) {
    const cat = categorizeSmtpError(e);
    console.error("[email] verify failed:", cat);
    return { ok: false, error: cat.message, errorKind: cat.kind, errorDetail: cat.detail };
  }
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendResult> {
  const t = await getTransporter();
  if (!t.ok) return reasonToResult(t.reason, t.detail);

  const finalFrom = t.fromEmail || "noreply@example.com";
  const finalName = t.fromName || "Lab Parfumo PO";

  try {
    await t.transporter.sendMail({
      from: `"${finalName}" <${finalFrom}>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return { ok: true };
  } catch (e) {
    const cat = categorizeSmtpError(e);
    console.error("[email] send failed:", cat);
    return { ok: false, error: cat.message, errorKind: cat.kind, errorDetail: cat.detail };
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
  const url = opts.loginUrl ?? `${resolveBaseUrl()}/login`;
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

// ==================================================================
// Daily digest — สรุปยอดประจำวันส่งให้แอดมิน
// ==================================================================
export interface DigestData {
  newPoCount: number;
  shippedToday: number;
  receivedToday: number;
  overdueCount: number;
  pendingApprovalCount: number;
  totalValueToday: number;
  topItems: Array<{ name: string; qty: number }>;
}

export async function sendDailyDigest(opts: {
  to: string;
  recipientName: string;
  data: DigestData;
  companyName: string;
  date: string; // formatted date e.g. "27 เมษายน 2026"
  appUrl?: string;
}): Promise<SendResult> {
  const url = resolveBaseUrl(opts.appUrl);
  const d = opts.data;
  const fmt = (n: number) => `฿${n.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;

  const subject = `📊 สรุปประจำวัน ${opts.date} — ${opts.companyName}`;

  const itemsHtml = d.topItems.length === 0
    ? '<tr><td style="padding:8px 0; color:#94A3B8; font-size:13px;">— ไม่มีรายการ —</td></tr>'
    : d.topItems.slice(0, 5).map((it) =>
        `<tr><td style="padding:6px 0; font-size:13px; color:#475569;">${escHtml(it.name)}</td>
         <td align="right" style="padding:6px 0; font-size:13px; font-weight:600; color:#1E293B;">×${it.qty}</td></tr>`,
      ).join("");

  const alertHtml = d.overdueCount + d.pendingApprovalCount > 0
    ? `<div style="background:#FEF3C7; border-left:4px solid #F59E0B; padding:12px 14px; border-radius:8px; margin:18px 0; font-size:13px; color:#78350F;">
         ⚠️ ${d.overdueCount > 0 ? `<strong>${d.overdueCount}</strong> ใบเลยกำหนดรับของ` : ""}
         ${d.overdueCount > 0 && d.pendingApprovalCount > 0 ? " • " : ""}
         ${d.pendingApprovalCount > 0 ? `<strong>${d.pendingApprovalCount}</strong> รายการรออนุมัติ` : ""}
       </div>`
    : "";

  const html = `<!doctype html>
<html lang="th">
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; background:#F8FAFC; font-family:'Sarabun',-apple-system,sans-serif; color:#1E293B;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F8FAFC; padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 12px rgba(15,23,42,0.08);">
        <tr><td style="background:linear-gradient(135deg,#3A5A8C,#1E3A5F); padding:28px 24px; text-align:center;">
          <h1 style="color:#fff; margin:0; font-size:20px;">📊 สรุปประจำวัน</h1>
          <p style="color:#A8C0E0; margin:6px 0 0; font-size:13px;">${escHtml(opts.date)} • ${escHtml(opts.companyName)}</p>
        </td></tr>
        <tr><td style="padding:24px 28px;">
          <p style="margin:0 0 16px; color:#475569; font-size:14px;">สวัสดี ${escHtml(opts.recipientName)},</p>
          ${alertHtml}
          <table cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0;">
            <tr>
              <td style="padding:14px; background:#F1F5F9; border-radius:10px; vertical-align:top; width:50%;">
                <div style="font-size:11px; color:#64748B; text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">📥 สร้างใหม่</div>
                <div style="font-size:24px; font-weight:700; color:#1E293B; margin-top:4px;">${d.newPoCount}</div>
                <div style="font-size:12px; color:#64748B; margin-top:2px;">ใบ</div>
              </td>
              <td style="width:8px;"></td>
              <td style="padding:14px; background:#F1F5F9; border-radius:10px; vertical-align:top; width:50%;">
                <div style="font-size:11px; color:#64748B; text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">💰 ยอดรวม</div>
                <div style="font-size:20px; font-weight:700; color:#3A5A8C; margin-top:4px;">${fmt(d.totalValueToday)}</div>
                <div style="font-size:12px; color:#64748B; margin-top:2px;">วันนี้</div>
              </td>
            </tr>
            <tr><td colspan="3" style="height:8px;"></td></tr>
            <tr>
              <td style="padding:14px; background:#F1F5F9; border-radius:10px; vertical-align:top;">
                <div style="font-size:11px; color:#64748B; text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">🚚 ส่งของ</div>
                <div style="font-size:24px; font-weight:700; color:#1E293B; margin-top:4px;">${d.shippedToday}</div>
              </td>
              <td style="width:8px;"></td>
              <td style="padding:14px; background:#F1F5F9; border-radius:10px; vertical-align:top;">
                <div style="font-size:11px; color:#64748B; text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">📦 รับของ</div>
                <div style="font-size:24px; font-weight:700; color:#10B981; margin-top:4px;">${d.receivedToday}</div>
              </td>
            </tr>
          </table>

          <h3 style="font-size:14px; color:#475569; margin:20px 0 8px; padding-bottom:6px; border-bottom:1px solid #E2E8F0;">🏆 Top สินค้าที่สั่งวันนี้</h3>
          <table cellpadding="0" cellspacing="0" width="100%">${itemsHtml}</table>

          <div style="text-align:center; margin:24px 0 8px;">
            <a href="${url}/dashboard" style="background:linear-gradient(135deg,#3A5A8C,#1E3A5F); color:#fff; padding:11px 22px; border-radius:10px; text-decoration:none; font-weight:600; font-size:14px; display:inline-block;">เปิด Dashboard →</a>
          </div>
        </td></tr>
        <tr><td style="padding:18px 24px; background:#F8FAFC; border-top:1px solid #E2E8F0; text-align:center;">
          <p style="margin:0; font-size:11px; color:#94A3B8;">📨 อีเมลฉบับนี้ส่งจาก Lab Parfumo PO Pro — รับทุกวันที่ 8:00 น.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = `สรุปประจำวัน ${opts.date} — ${opts.companyName}

📥 สร้างใหม่: ${d.newPoCount} ใบ
💰 ยอดรวมวันนี้: ${fmt(d.totalValueToday)}
🚚 ส่งของ: ${d.shippedToday}
📦 รับของ: ${d.receivedToday}
${d.overdueCount > 0 ? `⚠️ เลยกำหนด: ${d.overdueCount} ใบ\n` : ""}${d.pendingApprovalCount > 0 ? `⚠️ รออนุมัติ: ${d.pendingApprovalCount}\n` : ""}
Top รายการ:
${d.topItems.slice(0, 5).map((it) => `  • ${it.name} ×${it.qty}`).join("\n") || "  — ไม่มี —"}

เปิด Dashboard: ${url}/dashboard
`;

  return sendEmail({ to: opts.to, subject, html, text });
}

function escHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * หา base URL สำหรับใช้ในลิงก์อีเมล
 * Priority:
 *   1) opts.appUrl (override)
 *   2) NEXT_PUBLIC_APP_URL (custom domain — ตั้งเองใน Vercel env)
 *   3) VERCEL_PROJECT_PRODUCTION_URL (Vercel auto: production alias เช่น xxx.vercel.app)
 *   4) VERCEL_URL (Vercel auto: deployment-specific URL — มี SSO protection)
 *   5) localhost (dev fallback)
 *
 * ⚠️ VERCEL_URL = deployment-specific URL ทุก deploy เปลี่ยนตลอด + ถูก SSO protect
 *    บน preview deployments → ใช้ VERCEL_PROJECT_PRODUCTION_URL ก่อนเสมอ
 */
function resolveBaseUrl(override?: string): string {
  if (override) {
    console.log(`[resolveBaseUrl] using override: ${override}`);
    return override;
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    console.log(`[resolveBaseUrl] using NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL}`);
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    const url = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    console.log(`[resolveBaseUrl] using VERCEL_PROJECT_PRODUCTION_URL: ${url}`);
    return url;
  }
  if (process.env.VERCEL_URL) {
    const url = `https://${process.env.VERCEL_URL}`;
    console.warn(
      `[resolveBaseUrl] FALLBACK to VERCEL_URL (deployment-specific, may have SSO): ${url}\n` +
      `→ ตั้ง NEXT_PUBLIC_APP_URL ใน Vercel env เพื่อแก้ปัญหานี้`,
    );
    return url;
  }
  console.warn(`[resolveBaseUrl] no env var found, using localhost`);
  return "http://localhost:3000";
}

// ==================================================================
// PO update email — ส่งหา creator (5 transitions) + admin (PO ใหม่)
// ==================================================================
export type PoEmailKind =
  | "ordered"        // → "สั่งซื้อแล้ว" (creator)
  | "shipping"       // → "กำลังขนส่ง" (creator)
  | "completed"      // → "เสร็จสมบูรณ์" (creator)
  | "cancelled"      // → "ยกเลิก" (creator)
  | "issue"          // → "มีปัญหา" (creator)
  | "new_for_admin"; // PO ใหม่ — แจ้ง admin/supervisor

interface PoEmailTemplate {
  icon: string;
  title: string;
  headline: string;
  color: string;
  /** detail line — กรณี cancelled/issue ใส่ reason ลงไป */
  body: (o: PoUpdateEmailOpts) => string;
}

const PO_EMAIL_TEMPLATES: Record<PoEmailKind, PoEmailTemplate> = {
  ordered: {
    icon: "✅", title: "สั่งซื้อแล้ว",
    headline: "PO ของคุณถูกสั่งซื้อแล้ว",
    color: "#3B82F6",
    body: (o) => o.expectedDate ? `คาดว่าจะได้รับ ${o.expectedDate}` : "",
  },
  shipping: {
    icon: "🚚", title: "กำลังขนส่ง",
    headline: "Supplier ส่งของแล้ว — เตรียมรับของได้",
    color: "#8B5CF6",
    body: (o) => o.trackingNumber ? `Tracking: ${o.trackingNumber}` : "",
  },
  completed: {
    icon: "🎉", title: "เสร็จสมบูรณ์",
    headline: "PO ของคุณปิดงานเรียบร้อย",
    color: "#10B981",
    body: () => "ขอบคุณ — เก็บเป็น record ได้",
  },
  cancelled: {
    icon: "❌", title: "ถูกยกเลิก",
    headline: "PO ของคุณถูกยกเลิก",
    color: "#EF4444",
    body: (o) => {
      const parts = [`โดย ${o.by}`];
      if (o.reason) parts.push(o.reason);
      return parts.join(" • ");
    },
  },
  issue: {
    icon: "⚠️", title: "มีปัญหา",
    headline: "PO ของคุณมีปัญหา — ของไม่ครบ/เสียหาย",
    color: "#F59E0B",
    body: (o) => {
      const parts = [`แจ้งโดย ${o.by}`];
      if (o.reason) parts.push(o.reason);
      return parts.join(" • ");
    },
  },
  new_for_admin: {
    icon: "📥", title: "PO ใหม่",
    headline: "มี PO ใหม่รออนุมัติ",
    color: "#3B82F6",
    body: (o) => {
      const parts = [`จาก ${o.by}`];
      if (o.itemCount) parts.push(`${o.itemCount} รายการ`);
      return parts.join(" • ");
    },
  },
};

export interface PoUpdateEmailOpts {
  to: string;
  recipientName: string;
  poId: string;
  poNumber: string;
  kind: PoEmailKind;
  by: string;
  trackingNumber?: string;
  reason?: string;
  supplierName?: string;
  expectedDate?: string;
  itemCount?: number;
  appUrl?: string;
}

export async function sendPoUpdateEmail(opts: PoUpdateEmailOpts): Promise<SendResult> {
  const baseUrl = resolveBaseUrl(opts.appUrl);
  const poUrl = `${baseUrl}/po/${opts.poId}`;
  const prefsUrl = `${baseUrl}/preferences`;

  const t = PO_EMAIL_TEMPLATES[opts.kind];
  const detail = t.body(opts);
  const subject = `${t.icon} ${opts.poNumber} — ${t.title}`;

  const detailHtml = detail
    ? `<div style="font-size:13px; color:#475569; margin-top:12px;">${escHtml(detail)}</div>`
    : "";

  const html = `<!doctype html>
<html lang="th">
<head><meta charset="utf-8"><title>${escHtml(subject)}</title></head>
<body style="margin:0; padding:0; background:#F8FAFC; font-family:'Sarabun',-apple-system,BlinkMacSystemFont,sans-serif; color:#1E293B;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F8FAFC; padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 12px rgba(15,23,42,0.08);">
        <tr><td style="background:${t.color}; padding:24px; color:#fff; text-align:center;">
          <div style="font-size:36px; line-height:1;">${t.icon}</div>
          <div style="font-size:11px; font-weight:700; margin-top:8px; opacity:0.85; text-transform:uppercase; letter-spacing:0.08em;">${escHtml(t.title)}</div>
          <div style="font-size:20px; font-weight:bold; margin-top:6px; line-height:1.4;">${escHtml(t.headline)}</div>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 14px; font-size:15px;">สวัสดีคุณ <strong>${escHtml(opts.recipientName)}</strong>,</p>
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:18px; margin:18px 0;">
            <div style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase; letter-spacing:0.06em;">PO Number</div>
            <div style="font-size:18px; font-weight:bold; margin-top:4px; font-family:'JetBrains Mono',monospace; color:#1E293B;">${escHtml(opts.poNumber)}</div>
            ${detailHtml}
          </div>
          <p style="margin:24px 0; text-align:center;">
            <a href="${poUrl}" style="display:inline-block; background:${t.color}; color:#fff; padding:12px 28px; border-radius:10px; text-decoration:none; font-weight:600; font-size:14px;">ดูรายละเอียด PO →</a>
          </p>
          <p style="margin:24px 0 0; font-size:12px; color:#94A3B8; text-align:center; border-top:1px solid #E2E8F0; padding-top:18px;">
            อีเมลอัตโนมัติจากระบบ Lab Parfumo PO<br>
            หากไม่ต้องการรับอีเมลนี้ ตั้งค่าได้ที่ <a href="${prefsUrl}" style="color:#64748B;">การตั้งค่าการแจ้งเตือน</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `${t.icon} ${t.title}

PO: ${opts.poNumber}
${t.headline}
${detail ? detail + "\n" : ""}
ดูรายละเอียด: ${poUrl}

—
Lab Parfumo PO
ตั้งค่าการแจ้งเตือน: ${prefsUrl}
`;

  return sendEmail({ to: opts.to, subject, html, text });
}
