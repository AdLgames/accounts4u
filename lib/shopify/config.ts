function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const shopifyConfig = {
  apiVersion: "2025-01",
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
