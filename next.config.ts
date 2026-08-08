import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // No auth token configured yet -- source map upload is skipped (with a
  // build-time warning) until the user sets one up. Error capture itself
  // doesn't need it.
  silent: true,
});
