/**
 * Shared cron auth check — timing-safe Bearer token compare.
 * Used by /api/cron/* routes.
 */
import { timingSafeEqual } from "crypto";

export function authorizeCron(req: Request, sourceLabel: string): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn(
      `[${sourceLabel}] CRON_SECRET not set — rejecting all requests for safety.`,
    );
    return false;
  }
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;
  // Timing-safe compare — defense-in-depth vs `===` (defeats micro-timing attack).
  //   Requires same length; short-circuit ก่อน timingSafeEqual ที่ throw ถ้าไม่เท่า
  if (auth.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  } catch {
    return false;
  }
}
