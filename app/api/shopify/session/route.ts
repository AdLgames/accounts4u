import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { shopifyConfig } from "@/lib/shopify/config";
import { isValidShopDomain } from "@/lib/shopify/domain";
import { registerWebhooks } from "@/lib/shopify/register-webhooks";
import { runBackfill } from "@/lib/shopify/sync";

/**
 * Token Exchange (RFC 8693) — the embedded-app replacement for the classic
 * OAuth redirect. The client (app/shopify-bootstrap.tsx) gets a signed
 * session token from App Bridge and posts it here; we exchange it directly
 * with Shopify for an access token. No redirect, no cookies — Shopify
 * itself verifies the token's signature during the exchange, so we don't
 * need to independently verify it before forwarding.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as { shop?: string; idToken?: string };
  const { shop, idToken } = body;

  if (!shop || !isValidShopDomain(shop) || !idToken) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const exchangeResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: shopifyConfig.apiKey,
      client_secret: shopifyConfig.apiSecret,
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: idToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      requested_token_type: "urn:ietf:params:oauth:token-type:offline_access_token",
    }),
  });

  if (!exchangeResponse.ok) {
    console.error(`Token exchange failed for ${shop}: ${exchangeResponse.status} ${await exchangeResponse.text()}`);
    return NextResponse.json({ error: "Token exchange failed" }, { status: 502 });
  }

  const { access_token: accessToken, scope } = (await exchangeResponse.json()) as {
    access_token: string;
    scope: string;
  };

  const store = await prisma.store.upsert({
    where: { shopDomain: shop },
    create: { shopDomain: shop, accessToken, scope },
    update: { accessToken, scope },
  });

  // Best-effort, same caveats as before: shouldn't block the response, and
  // a large store's backfill could hit Vercel's function timeout.
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

  return NextResponse.json({ ok: true });
}
