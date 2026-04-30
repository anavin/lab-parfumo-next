/**
 * Sentry — Browser (client-side errors in React components, event handlers)
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    sampleRate: process.env.NODE_ENV === "production" ? 0.3 : 1.0,
    tracesSampleRate: 0,
    // Replay (visual reproduction) — disabled by default to save quota
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",   // benign browser warning
      "Non-Error promise rejection captured",  // not actionable
    ],
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
  });
}
