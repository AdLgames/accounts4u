import Stripe from "stripe";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let cached: Stripe | null = null;

/** Lazily constructed so routes that don't touch Stripe don't require the env var to be set. */
export function getStripeClient(): Stripe {
  cached ??= new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  return cached;
}

export const stripeConfig = {
  get priceId(): string {
    return requireEnv("STRIPE_PRICE_ID");
  },
  get webhookSecret(): string {
    return requireEnv("STRIPE_WEBHOOK_SECRET");
  },
};
