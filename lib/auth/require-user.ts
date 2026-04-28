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

/** Require admin user — redirects to /dashboard if not admin (or /login if not signed in) */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
