/**
 * Email/SMTP settings — อ่านจากตาราง company_settings
 *
 * ลำดับความสำคัญ:
 *   1) Env vars (SMTP_HOST, SMTP_USER, SMTP_PASSWORD, ...) — ถ้ามีครบ
 *   2) DB (company_settings) — ใช้เมื่อ env ไม่ครบ
 *
 * Env vars ชนะ DB เพื่อให้ deploy/preview override ได้
 * แต่ถ้าไม่ตั้ง env เลย admin สามารถตั้งผ่าน UI
 */
import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type EmailSettingsSource =
  | "env"               // ใช้ค่าจาก environment variables
  | "db"                // ใช้ค่าจาก DB
  | "none"              // ยังไม่ได้ตั้งค่า
  | "migration-needed"  // DB column ยังไม่ถูกสร้าง (ต้องรัน migration)
  | "db-error";         // DB error อื่นๆ

export interface EmailSettings {
  host: string;
  port: number;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  secure: boolean;
  source: EmailSettingsSource;
  /** ข้อความ error จาก DB (debug) — ใส่เมื่อ source = migration-needed/db-error */
  errorDetail?: string;
}

interface DbRow {
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  smtp_from_email?: string;
  smtp_from_name?: string;
  smtp_secure?: boolean;
}

const EMPTY_SETTINGS = {
  host: "", port: 587, user: "", password: "",
  fromEmail: "", fromName: "", secure: false,
} as const;

/**
 * อ่าน SMTP config — รวม env + DB
 * ถ้าไม่มี config ทั้งสองที่ — return source: "none"
 */
export async function getEmailSettings(): Promise<EmailSettings> {
  // 1) Env vars
  const envHost = process.env.SMTP_HOST?.trim();
  const envUser = process.env.SMTP_USER?.trim();
  const envPass = process.env.SMTP_PASSWORD?.trim();

  if (envHost && envUser && envPass) {
    const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
    return {
      host: envHost,
      port,
      user: envUser,
      password: envPass,
      fromEmail: process.env.FROM_EMAIL?.trim() || envUser,
      fromName: process.env.FROM_NAME?.trim() || "Lab Parfumo PO",
      secure: port === 465,
      source: "env",
    };
  }

  // 2) DB
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("company_settings" as never)
      .select(
        "smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_email, smtp_from_name, smtp_secure",
      )
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      const msg = error.message || "";
      // PostgreSQL error code 42703 = column does not exist
      // หรือ Supabase response มี hint ตรงๆ
      const isMigrationIssue =
        error.code === "42703" ||
        /column .* does not exist/i.test(msg) ||
        /smtp_host/i.test(msg);
      console.error("[email-settings] DB read failed:", error);
      return {
        ...EMPTY_SETTINGS,
        source: isMigrationIssue ? "migration-needed" : "db-error",
        errorDetail: msg,
      };
    }

    const row = (data ?? {}) as DbRow;
    if (row.smtp_host && row.smtp_user && row.smtp_password) {
      return {
        host: row.smtp_host,
        port: row.smtp_port ?? 587,
        user: row.smtp_user,
        password: row.smtp_password,
        fromEmail: row.smtp_from_email || row.smtp_user,
        fromName: row.smtp_from_name || "Lab Parfumo PO",
        secure: !!row.smtp_secure,
        source: "db",
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[email-settings] DB read exception:", e);
    return {
      ...EMPTY_SETTINGS,
      source: "db-error",
      errorDetail: msg,
    };
  }

  // 3) None
  return { ...EMPTY_SETTINGS, source: "none" };
}

/**
 * อ่านเฉพาะที่ปลอดภัยพอ render UI ได้
 * (ซ่อน password — แค่บอกว่ามีหรือไม่)
 */
export async function getEmailSettingsForUi(): Promise<{
  host: string;
  port: number;
  user: string;
  hasPassword: boolean;
  fromEmail: string;
  fromName: string;
  secure: boolean;
  source: EmailSettingsSource;
  errorDetail?: string;
  /** ถ้า env ตั้งไว้ → UI ควร readonly */
  managedByEnv: boolean;
}> {
  const s = await getEmailSettings();
  return {
    host: s.host,
    port: s.port,
    user: s.user,
    hasPassword: !!s.password,
    fromEmail: s.fromEmail,
    fromName: s.fromName,
    secure: s.secure,
    source: s.source,
    errorDetail: s.errorDetail,
    managedByEnv: s.source === "env",
  };
}
