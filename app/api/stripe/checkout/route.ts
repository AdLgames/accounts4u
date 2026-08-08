import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { iframeBreakoutRedirect } from "@/lib/http/iframe-breakout";
import { isValidShopDomain } from "@/lib/shopify/domain";
import { shopifyConfig } from "@/lib/shopify/config";
import { getStripeClient, stripeConfig } from "@/lib/stripe/client";

export async function GET(request: NextRequest) {
  const shop = request.nextUrl.searchParams.get("shop");
  if (!shop || !isValidShopDomain(shop)) {
    return NextResponse.json({ error: "Invalid or missing shop parameter" }, { status: 400 });
  }

  const store = await prisma.store.findUnique({ where: { shopDomain: shop } });
  if (!store) {
    return NextResponse.json({ error: "Unknown store" }, { status: 404 });
  }

  const returnUrl = new URL("/", shopifyConfig.appUrl);
  returnUrl.searchParams.set("shop", shop);

  const session = await getStripeClient().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: stripeConfig.priceId, quantity: 1 }],
    customer: store.stripeCustomerId ?? undefined,
    client_reference_id: store.id,
    subscription_data: { metadata: { storeId: store.id } },
    success_url: `${returnUrl.toString()}&checkout=success`,
    cancel_url: `${returnUrl.toString()}&checkout=cancelled`,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 502 });
  }

  return iframeBreakoutRedirect(session.url);
}
