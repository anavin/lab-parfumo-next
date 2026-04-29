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
