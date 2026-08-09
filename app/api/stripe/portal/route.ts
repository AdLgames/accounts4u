import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { iframeBreakoutRedirect } from "@/lib/http/iframe-breakout";
import { isValidShopDomain } from "@/lib/shopify/domain";
import { shopifyConfig } from "@/lib/shopify/config";
import { getStripeClient } from "@/lib/stripe/client";

export async function GET(request: NextRequest) {
  const shop = request.nextUrl.searchParams.get("shop");
  if (!shop || !isValidShopDomain(shop)) {
    return NextResponse.json({ error: "Invalid or missing shop parameter" }, { status: 400 });
  }

  const store = await prisma.store.findUnique({ where: { shopDomain: shop } });
  if (!store?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account yet — subscribe first" }, { status: 404 });
  }

  const returnUrl = new URL("/inputs", shopifyConfig.appUrl);
  returnUrl.searchParams.set("shop", shop);

  const session = await getStripeClient().billingPortal.sessions.create({
    customer: store.stripeCustomerId,
    return_url: returnUrl.toString(),
  });

  return iframeBreakoutRedirect(session.url);
}
