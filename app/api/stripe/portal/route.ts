import { NextRequest, NextResponse } from "next/server";
import { iframeBreakoutRedirect } from "@/lib/http/iframe-breakout";
import { shopifyConfig } from "@/lib/shopify/config";
import { resolveAuthenticatedStore } from "@/lib/shopify/current-store";
import { getStripeClient } from "@/lib/stripe/client";

export async function GET(request: NextRequest) {
  const shop = request.nextUrl.searchParams.get("shop") ?? undefined;
  const store = await resolveAuthenticatedStore(shop);
  if (!store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!store.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account yet — subscribe first" }, { status: 404 });
  }

  const returnUrl = new URL("/inputs", shopifyConfig.appUrl);
  returnUrl.searchParams.set("shop", store.shopDomain);

  const session = await getStripeClient().billingPortal.sessions.create({
    customer: store.stripeCustomerId,
    return_url: returnUrl.toString(),
  });

  return iframeBreakoutRedirect(session.url);
}
