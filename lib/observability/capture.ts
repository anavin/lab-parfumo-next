/**
 * Small helper — wrap catch blocks that currently only console.error
 * with Sentry.captureException, without ceremony. No-op if Sentry DSN
 * isn't set (init in sentry.server.config already gated).
 *
 * Usage:
 *   } catch (e) {
 *     captureError(e, "po.cancelPoAction", { poId });
 *   }
 */
import * as Sentry from "@sentry/nextjs";

export function captureError(
  err: unknown,
  where: string,
  extra?: Record<string, unknown>,
) {
  try {
    Sentry.captureException(err, {
      tags: { source: where },
      extra: extra ?? {},
    });
  } catch {
    // Sentry itself throwing shouldn't propagate — just log
  }
  // Always log locally too (Vercel logs)
  console.error(`[${where}]`, err, extra ?? "");
}
