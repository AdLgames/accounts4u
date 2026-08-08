import { shopifyConfig } from "./config";
import { shopifyGraphql } from "./graphql";

const MUTATION = `#graphql
  mutation RegisterWebhook($topic: WebhookSubscriptionTopic!, $callbackUrl: URL!) {
    webhookSubscriptionCreate(
      topic: $topic
      webhookSubscription: { callbackUrl: $callbackUrl, format: JSON }
    ) {
      webhookSubscription { id }
      userErrors { field message }
    }
  }
`;

type MutationResult = {
  webhookSubscriptionCreate: {
    webhookSubscription: { id: string } | null;
    userErrors: { field: string[]; message: string }[];
  };
};

// Shopify Payments payouts aren't covered by a general-availability webhook
// topic, so they're synced by the scheduled sweep (lib/shopify/sync.ts)
// instead — this matches PLAN.md's framing of webhooks as best-effort with
// the sweep as the backup. orders/create and refunds/create are covered
// here since those topics are stable and well-documented.
const TOPICS = ["ORDERS_CREATE", "REFUNDS_CREATE"] as const;

export async function registerWebhooks(shopDomain: string, accessToken: string): Promise<void> {
  const callbackUrl = new URL("/api/shopify/webhooks", shopifyConfig.appUrl).toString();

  for (const topic of TOPICS) {
    const result = await shopifyGraphql<MutationResult>(shopDomain, accessToken, MUTATION, {
      topic,
      callbackUrl,
    });
    const errors = result.webhookSubscriptionCreate.userErrors;
    if (errors.length > 0) {
      throw new Error(`Webhook registration failed for ${topic}: ${JSON.stringify(errors)}`);
    }
  }
}
