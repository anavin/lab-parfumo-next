/**
 * Sentry — Edge runtime (middleware errors)
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    sampleRate: process.env.NODE_ENV === "production" ? 0.3 : 1.0,
    tracesSampleRate: 0,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  });
}
