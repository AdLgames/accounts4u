function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const shopifyConfig = {
  // Shopify sunsets API versions ~1 year after release. 2025-01 was already
  // retired by the time this was tested live (Aug 2026) -- confirmed against
  // this app's actual configured version in the Dev Dashboard's Webhooks
  // section. REST/GraphQL calls against a sunset version fail, and the
  // backfill's error handling swallows that silently -- update this if the
  // Dev Dashboard ever shows a newer version than this.
  apiVersion: "2026-07",
  get apiKey(): string {
    return requireEnv("SHOPIFY_API_KEY");
  },
  get apiSecret(): string {
    return requireEnv("SHOPIFY_API_SECRET");
  },
  get appUrl(): string {
    return requireEnv("SHOPIFY_APP_URL");
  },
  get scopes(): string[] {
    // Orders + products (COGS mapping later) + Shopify Payments payouts,
    // per PLAN.md Phase 2 step 2. Override via env if a store needs more.
    const raw = process.env.SHOPIFY_SCOPES ?? "read_orders,read_products,read_shopify_payments_payouts";
    return raw.split(",").map((scope) => scope.trim()).filter(Boolean);
  },
};
