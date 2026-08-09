import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // `next dev` otherwise auto-appends a Next.js agent-rules block to this
  // repo's own CLAUDE.md (its conventions doc, unrelated to Next.js
  // itself) on every dev server start — surfaced as an unexpected diff
  // during this session's local testing. Off since CLAUDE.md is
  // deliberately hand-authored (see the file itself).
  agentRules: false,
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // No auth token configured yet -- source map upload is skipped (with a
  // build-time warning) until the user sets one up. Error capture itself
  // doesn't need it.
  silent: true,
});
