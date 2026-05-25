/**
 * Rate limiting helper — sliding window via Upstash Redis
 *
 * **Graceful degradation**: if UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN
 * is missing, every check returns `{ allowed: true }`. The app keeps working;
 * rate limit just isn't enforced. This means:
 *   - dev / local works without setting up Upstash
 *   - prod fails open if Redis is unreachable (acceptable — we still have
 *     the username-based 5/15min lockout in DB as defense in depth)
 *
 * Policies in this file:
 *   - LOGIN_LIMITER:   5 attempts per IP / 15 min — defeats credential stuffing
 *   - CREATE_PO_LIMITER: 60 POs per user / hour — defeats accidental duplicate
 *     form submits + abusive automation
 *
 * Pattern usage:
 *   const r = await checkLimit(LOGIN_LIMITER, `login:${ip}`);
 *   if (!r.allowed) return { ok: false, error: r.retryAfterText };
 */
import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

interface LimitResult {
  allowed: boolean;
  /** Seconds until the user can try again (only present when blocked) */
  retryAfterSeconds?: number;
  /** Pre-formatted Thai message (only present when blocked) */
  retryAfterText?: string;
}

// Lazy singleton — only instantiate Redis if env is configured
let _redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    _redis = null;
    return null;
  }
  _redis = new Redis({ url, token });
  return _redis;
}

// Lazy limiters — reused across requests (matches Upstash recommendation)
const _limiters = new Map<string, Ratelimit>();
function getLimiter(name: string, build: (r: Redis) => Ratelimit): Ratelimit | null {
  const cached = _limiters.get(name);
  if (cached) return cached;
  const redis = getRedis();
  if (!redis) return null;
  const fresh = build(redis);
  _limiters.set(name, fresh);
  return fresh;
}

export const LOGIN_LIMITER = "login";
export const CREATE_PO_LIMITER = "create-po";

const LIMITER_BUILDERS: Record<string, (r: Redis) => Ratelimit> = {
  [LOGIN_LIMITER]: (r) =>
    new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      analytics: false,
      prefix: "rl:login",
    }),
  [CREATE_PO_LIMITER]: (r) =>
    new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(60, "1 h"),
      analytics: false,
      prefix: "rl:po",
    }),
};

function thaiDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} วินาที`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} นาที`;
  return `${Math.ceil(seconds / 3600)} ชั่วโมง`;
}

/**
 * Check a rate-limit policy for a given key. Returns `{ allowed: true }`
 * when Redis is not configured (graceful degradation).
 *
 * @param limiterName  policy id — use one of the exported constants
 * @param key          unique key for the bucket (e.g. `login:1.2.3.4` or `po:user-uuid`)
 */
export async function checkRateLimit(
  limiterName: string,
  key: string,
): Promise<LimitResult> {
  const builder = LIMITER_BUILDERS[limiterName];
  if (!builder) {
    console.warn(`[ratelimit] unknown limiter: ${limiterName}`);
    return { allowed: true };
  }
  const limiter = getLimiter(limiterName, builder);
  if (!limiter) {
    // Upstash not configured — fail open
    return { allowed: true };
  }
  try {
    const r = await limiter.limit(key);
    if (r.success) return { allowed: true };
    const retryMs = Math.max(0, r.reset - Date.now());
    const retrySec = Math.ceil(retryMs / 1000);
    return {
      allowed: false,
      retryAfterSeconds: retrySec,
      retryAfterText: `เกินจำนวนคำขอ — ลองอีกครั้งใน ${thaiDuration(retrySec)}`,
    };
  } catch (e) {
    console.warn("[ratelimit] check failed (fail-open):", e);
    return { allowed: true };
  }
}

/**
 * Extract the request's client IP from Next.js headers. Vercel sets
 * x-forwarded-for to a comma-separated list — we use the first hop.
 */
export function clientIp(headers: { get: (key: string) => string | null }): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
