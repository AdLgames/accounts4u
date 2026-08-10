import * as Sentry from "@sentry/nextjs";
import { prisma } from "../db";
import { getStripeClient } from "../stripe/client";

export interface ReconcileResult {
  checked: number;
  corrected: number;
}

/**
 * Backup for best-effort Stripe webhooks (app/api/stripe/webhook/route.ts)
 * -- same "webhooks plus a periodic reconciliation sweep" pattern already
 * used for Shopify sync (lib/shopify/sync.ts's runSyncSweep), since a
 * missed webhook here has real consequences in both directions:
 *
 * - A merchant who genuinely paid but whose checkout.session.completed
 *   delivery failed stays wrongly locked out of Inputs indefinitely, with
 *   nothing to self-heal it.
 * - A merchant whose subscription lapsed (payment failed, they canceled)
 *   but whose customer.subscription.updated/deleted delivery failed keeps
 *   write access to a product they're no longer paying for.
 *
 * Only reconciles stores that have been through Checkout at least once
 * (stripeSubscriptionId set) -- a pure-trial store has nothing in Stripe
 * to check yet, and calling Stripe for every store on every run would be
 * pure waste.
 *
 * Serial loop over stores, same shape as the Shopify sync cron route --
 * inherits the same "won't scale past some store count in one cron
 * invocation" caveat already flagged there; a single subscription lookup
 * is far cheaper than a full Shopify sync, so this has more headroom, but
 * the real fix at very large scale is the same fan-out queue, not
 * something solved differently here.
 */
export async function reconcileSubscriptionStatuses(): Promise<ReconcileResult> {
  const stores = await prisma.store.findMany({
    where: { stripeSubscriptionId: { not: null } },
    select: { id: true, shopDomain: true, stripeSubscriptionId: true, subscriptionStatus: true },
  });

  const stripe = getStripeClient();
  let corrected = 0;

  for (const store of stores) {
    try {
      // Non-null by the query filter above -- Prisma's type doesn't narrow across the where clause.
      const subscription = await stripe.subscriptions.retrieve(store.stripeSubscriptionId as string);
      if (subscription.status !== store.subscriptionStatus) {
        await prisma.store.update({ where: { id: store.id }, data: { subscriptionStatus: subscription.status } });
        corrected++;
      }
    } catch (error) {
      console.error(`Stripe subscription reconciliation failed for ${store.shopDomain}:`, error);
      Sentry.captureException(error, { tags: { shop: store.shopDomain } });
    }
  }

  return { checked: stores.length, corrected };
}
