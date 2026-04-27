/**
 * Session management — ใช้ตาราง user_sessions ของเดิม
 *
 * เหมือนระบบ Streamlit เดิม:
 * - cookie ชื่อ "lp_session" → token
 * - DB row ใน user_sessions (token, user_id, last_activity_at)
 * - Idle timeout: 60 นาที (เหมือนเดิม)
 */
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { User } from "@/lib/types/db";

export const SESSION_COOKIE = "lp_session";
export const SESSION_IDLE_MIN = 60;
export const SESSION_COOKIE_MAX_AGE_DAYS = 7;

/**
 * สร้าง session token ใหม่ + insert ใน DB
 */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("user_sessions")
    .insert({ token, user_id: userId });
  if (error) {
    console.error("[session] insert failed:", error);
    throw new Error("ไม่สามารถสร้าง session ได้");
  }
  return token;
}

/**
 * ดึง user จาก token (ตรวจ idle + active)
 */
export async function getUserFromToken(
  token: string | undefined,
): Promise<User | null> {
  if (!token) return null;
  const sb = getSupabaseAdmin();

  const { data: sess } = await sb
    .from("user_sessions")
    .select("token, user_id, last_activity_at")
    .eq("token", token)
    .maybeSingle();
  if (!sess) return null;

  // Idle timeout check
  const last = sess.last_activity_at ? new Date(sess.last_activity_at).getTime() : 0;
  const idleMin = (Date.now() - last) / 60_000;
  if (idleMin > SESSION_IDLE_MIN) {
    await deleteSession(token);
    return null;
  }

  const { data: user } = await sb
    .from("users")
    .select("*")
    .eq("id", sess.user_id)
    .eq("is_active", true)
    .maybeSingle();
  if (!user) return null;

  // Touch session (fire-and-forget)
  sb.from("user_sessions")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("token", token)
    .then(() => {}, () => {});

  return user as User;
}

/**
 * ลบ session token ออกจาก DB
 */
export async function deleteSession(token: string): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.from("user_sessions").delete().eq("token", token);
}

/**
 * Helper ใน Server Components — ดึง user ปัจจุบัน
 */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return getUserFromToken(token);
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_COOKIE_MAX_AGE_DAYS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
