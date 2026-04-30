/**
 * Next.js instrumentation — initializes Sentry across runtimes
 *
 * Activates only if SENTRY_DSN env is set.
 * If not set → graceful no-op (no errors, no warnings).
 */

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
  if (!dsn) return; // No DSN → skip init

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Capture errors from Server Components / route handlers
// Signature matches Next.js 15 `onRequestError` hook
export async function onRequestError(
  err: unknown,
  request: {
    path: string;
    method: string;
    headers: Record<string, string | string[] | undefined>;
  },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(err, request, context);
}
