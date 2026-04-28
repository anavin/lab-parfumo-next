/**
 * Session management — ใช้ตาราง user_sessions ของเดิม
 *
 * เหมือนระบบ Streamlit เดิม:
 * - cookie ชื่อ "lp_session" → token
 * - DB row ใน user_sessions (token, user_id, last_activity_at)
 * - Idle timeout: 60 นาที (เหมือนเดิม)
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { User } from "@/lib/types/db";
import {
  SESSION_COOKIE, SESSION_IDLE_MIN, SESSION_COOKIE_MAX_AGE_DAYS,
} from "./constants";

// Re-export — เผื่อมี import เก่าจาก session.ts
export { SESSION_COOKIE, SESSION_IDLE_MIN, SESSION_COOKIE_MAX_AGE_DAYS };

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
 *
 * ⚡ JOIN session + users ใน 1 query (เร็วกว่า 2 queries แยกกัน)
 *    + touch session แบบ fire-and-forget (ไม่ block response)
 */
export async function getUserFromToken(
  token: string | undefined,
): Promise<User | null> {
  if (!token) return null;
  const sb = getSupabaseAdmin();

  // 1 query แทน 2 — JOIN session + user
  const { data } = await sb
    .from("user_sessions")
    .select("token, user_id, last_activity_at, users!inner(*)")
    .eq("token", token)
    .eq("users.is_active", true)
    .maybeSingle();

  if (!data || !data.users) return null;

  // Idle timeout check
  const last = data.last_activity_at ? new Date(data.last_activity_at).getTime() : 0;
  const idleMin = (Date.now() - last) / 60_000;
  if (idleMin > SESSION_IDLE_MIN) {
    // fire-and-forget delete — log error เพื่อ debug
    sb.from("user_sessions").delete().eq("token", token).then(
      () => {},
      (err) => console.error("[session] expired-cleanup failed:", err),
    );
    return null;
  }

  // Touch session — fire-and-forget แต่ log error เพื่อให้รู้ถ้า DB hiccup
  // (ผลคือถ้าหลายคำขอติด error → idle timeout จะเตือนผู้ใช้ก่อนเวลา)
  sb.from("user_sessions")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("token", token)
    .then(
      () => {},
      (err) => console.error("[session] touch failed:", err),
    );

  // Supabase nested return — users เป็น array หรือ object ขึ้นกับ relationship
  const user = Array.isArray(data.users) ? data.users[0] : data.users;
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
 *
 * ⚡ Wrapped ด้วย React.cache() — dedupe call ใน same request
 *    layout + page เรียกพร้อมกันก็ไป DB แค่ครั้งเดียว
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return getUserFromToken(token);
});

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
