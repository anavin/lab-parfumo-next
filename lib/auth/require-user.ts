/**
 * Auth guards for Server Components — replaces `(await getCurrentUser())!`
 *
 * Layout guarantees a user is logged in (redirects if not), but page components
 * shouldn't bet on layout running first. These helpers redirect cleanly if
 * the session expired between layout and page render.
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";
import type { User } from "@/lib/types/db";

/** Require any authenticated user — redirects to /login if missing */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require admin OR supervisor — สำหรับหน้าที่ supervisor ใช้ได้
 * (equipment, users, budget, reports — ทุกอย่างยกเว้น settings)
 */
export async function requirePrivileged(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "supervisor") {
    redirect("/dashboard");
  }
  return user;
}

/**
 * Require admin user เท่านั้น — สำหรับหน้า /settings และ admin-only operations
 * Supervisor จะถูก redirect ไป /dashboard
 */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}

/** Helper: ตรวจว่า user มีสิทธิ์ระดับ admin/supervisor หรือไม่ */
export function isPrivileged(user: User | null | undefined): boolean {
  return !!user && (user.role === "admin" || user.role === "supervisor");
}

/**
 * Server-action helper — return error result instead of redirecting
 * (redirect() ใน action จะ throw NEXT_REDIRECT exception ที่ client เข้าใจไม่ตรง)
 *
 * Usage:
 *   const auth = await requirePrivilegedAction();
 *   if (!auth.ok) return { ok: false, error: auth.error };
 *   const me = auth.user;
 */
export async function requirePrivilegedAction(): Promise<
  | { ok: true; user: User }
  | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };
  }
  if (user.role !== "admin" && user.role !== "supervisor") {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  return { ok: true, user };
}
