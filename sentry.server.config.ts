/**
 * Sentry — Node.js (server-side errors in pages, server actions, route handlers)
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Reduce data volume — sample 30% of error events in production
    sampleRate: process.env.NODE_ENV === "production" ? 0.3 : 1.0,
    // Don't sample performance traces by default (saves quota)
    tracesSampleRate: 0,
    // Attach deploy sha so stack traces link back to the right commit
    release: process.env.VERCEL_GIT_COMMIT_SHA
      ? `lab-parfumo-next@${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}`
      : undefined,
    // Filter out noise: HTTP 4xx errors are usually user input issues
    ignoreErrors: [
      "NEXT_REDIRECT",        // Next.js redirect mechanism — not real error
      "NEXT_NOT_FOUND",
    ],
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    beforeSend(event, hint) {
      // Drop expected "no rows" from maybeSingle() — noise
      const msg = String(hint?.originalException ?? event.message ?? "");
      if (msg.includes("PGRST116")) return null;
      return event;
    },
  });
}
