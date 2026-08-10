import { NextRequest, NextResponse } from "next/server";
import { reconcileSubscriptionStatuses } from "@/lib/billing/reconcile";

/**
 * Scheduled backup for best-effort Stripe webhooks (see
 * lib/billing/reconcile.ts) -- wired to Vercel Cron in vercel.json,
 * authenticated via the same CRON_SECRET the Shopify sync sweep uses.
 * Daily cadence: subscription status doesn't need real-time correction,
 * just a safety net against a missed webhook drifting our copy of it.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await reconcileSubscriptionStatuses();
  return NextResponse.json(result);
}
