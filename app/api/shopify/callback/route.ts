import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { shopifyConfig } from "@/lib/shopify/config";
import { isValidShopDomain } from "@/lib/shopify/domain";
import { verifyQueryHmac } from "@/lib/shopify/hmac";
import { exchangeCodeForToken } from "@/lib/shopify/oauth";
import { registerWebhooks } from "@/lib/shopify/register-webhooks";
import { verifyState } from "@/lib/shopify/state";
import { runBackfill } from "@/lib/shopify/sync";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const shop = searchParams.get("shop");
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!shop || !isValidShopDomain(shop) || !code || !state) {
    return NextResponse.json({ error: "Invalid callback parameters" }, { status: 400 });
  }

  if (!verifyState(state, shop, shopifyConfig.apiSecret)) {
    return NextResponse.json({ error: "Invalid or expired state" }, { status: 403 });
  }

  const rawQuery = request.nextUrl.search.replace(/^\?/, "");
  if (!verifyQueryHmac(rawQuery, shopifyConfig.apiSecret)) {
    return NextResponse.json({ error: "Invalid HMAC" }, { status: 403 });
  }

  const { accessToken, scope } = await exchangeCodeForToken(shop, code);

  const store = await prisma.store.upsert({
    where: { shopDomain: shop },
    create: { shopDomain: shop, accessToken, scope },
    update: { accessToken, scope },
  });

  // Best-effort: a failure here shouldn't block completing the install.
  // Vercel's function timeout can cut off a large store's backfill — if that
  // becomes a real problem, move this to a background job instead of
  // awaiting it inline.
  try {
    await registerWebhooks(shop, accessToken);
  } catch (error) {
    console.error(`registerWebhooks failed for ${shop}:`, error);
  }
  try {
    await runBackfill(store);
  } catch (error) {
    console.error(`runBackfill failed for ${shop}:`, error);
  }

  // This request runs at the top level (having broken out of the iframe in
  // /api/shopify/install), so send the merchant back into Shopify admin
  // rather than stranding them on our bare domain.
  return NextResponse.redirect(`https://${shop}/admin/apps/${shopifyConfig.apiKey}`);
}
