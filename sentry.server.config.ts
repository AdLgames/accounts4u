import * as Sentry from "@sentry/nextjs";

// No-ops if SENTRY_DSN is unset (local dev, and until the user creates a
// free-tier Sentry project) -- the SDK is safe to initialize unconditionally.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0,
});
