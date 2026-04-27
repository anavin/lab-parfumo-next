/**
 * Login flow — ตรวจ password + log attempt + lockout + auto-upgrade hash
 * mirror Python verify_user()
 */
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  hashBcrypt, isLegacySha256, verifyBcrypt, verifyLegacySha256,
} from "./password";
import type { User } from "@/lib/types/db";

const LOCKOUT_MIN = 15;
const MAX_ATTEMPTS = 5;

export interface LoginResult {
  ok: boolean;
  user?: User;
  error?: string;
  attemptsRemaining?: number;
}

async function logAttempt(username: string, success: boolean) {
  const sb = getSupabaseAdmin();
  await sb.from("login_attempts").insert({ username, success });
}

async function getFailedAttempts(username: string): Promise<number> {
  const sb = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - LOCKOUT_MIN * 60_000).toISOString();
  const { count } = await sb
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("username", username)
    .eq("success", false)
    .gte("created_at", cutoff);
  return count ?? 0;
}

async function isAccountLocked(username: string): Promise<boolean> {
  return (await getFailedAttempts(username)) >= MAX_ATTEMPTS;
}

export async function getRemainingAttempts(username: string): Promise<number> {
  const used = await getFailedAttempts(username);
  return Math.max(0, MAX_ATTEMPTS - used);
}

export async function loginWithPassword(
  username: string,
  password: string,
): Promise<LoginResult> {
  if (!username || !password) {
    return { ok: false, error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" };
  }

  if (await isAccountLocked(username)) {
    return { ok: false, error: `🔒 บัญชีถูกล็อคชั่วคราว — รอ ${LOCKOUT_MIN} นาที` };
  }

  const sb = getSupabaseAdmin();
  const { data: user } = await sb
    .from("users")
    .select("*")
    .eq("username", username)
    .eq("is_active", true)
    .maybeSingle();

  if (!user) {
    await logAttempt(username, false);
    const remaining = await getRemainingAttempts(username);
    return {
      ok: false,
      error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
      attemptsRemaining: remaining,
    };
  }

  const stored = user.password_hash;
  let verified = false;
  let needsUpgrade = false;

  if (isLegacySha256(stored)) {
    if (verifyLegacySha256(password, stored)) {
      verified = true;
      needsUpgrade = true;
    }
  } else {
    verified = await verifyBcrypt(password, stored);
  }

  if (!verified) {
    await logAttempt(username, false);
    const remaining = await getRemainingAttempts(username);
    return {
      ok: false,
      error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
      attemptsRemaining: remaining,
    };
  }

  // success
  await logAttempt(username, true);

  const updatePayload: Record<string, unknown> = {
    last_login_at: new Date().toISOString(),
    failed_login_count: 0,
  };
  if (needsUpgrade) {
    updatePayload.password_hash = await hashBcrypt(password);
  }
  await sb.from("users").update(updatePayload).eq("id", user.id);

  // refresh user data ถ้าอัปเกรด hash
  if (needsUpgrade) {
    const { data: refreshed } = await sb
      .from("users")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (refreshed) return { ok: true, user: refreshed as User };
  }
  return { ok: true, user: user as User };
}
