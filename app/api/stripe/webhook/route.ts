import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripeClient, stripeConfig } from "@/lib/stripe/client";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, stripeConfig.webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const storeId = session.client_reference_id;
      if (storeId && session.customer && session.subscription) {
        await updateStore(storeId, {
          stripeCustomerId: String(session.customer),
          stripeSubscriptionId: String(session.subscription),
          subscriptionStatus: "active",
        });
      }
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const storeId = subscription.metadata.storeId;
      if (storeId) {
        await updateStore(storeId, { subscriptionStatus: subscription.status });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const storeId = subscription.metadata.storeId;
      if (storeId) {
        await updateStore(storeId, { subscriptionStatus: "canceled" });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

/** A store row can legitimately be gone by the time this fires (e.g. a shop/redact ran in between) -- don't let that surface as an error to Stripe, which would just retry forever. */
async function updateStore(storeId: string, data: { subscriptionStatus: string; stripeCustomerId?: string; stripeSubscriptionId?: string }) {
  try {
    await prisma.store.update({ where: { id: storeId }, data });
  } catch (error) {
    console.error(`Failed to update store ${storeId} from Stripe webhook:`, error);
  }
}
