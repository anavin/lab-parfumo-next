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
    // Filter out noise: HTTP 4xx errors are usually user input issues
    ignoreErrors: [
      "NEXT_REDIRECT",        // Next.js redirect mechanism — not real error
      "NEXT_NOT_FOUND",
    ],
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  });
}
