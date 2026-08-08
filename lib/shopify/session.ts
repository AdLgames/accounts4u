import { prisma } from "@/lib/db";
import { shopifyConfig } from "./config";
import { isValidShopDomain } from "./domain";
import { registerWebhooks } from "./register-webhooks";
import { runBackfill } from "./sync";

/**
 * Token Exchange (RFC 8693) — the embedded-app replacement for the classic
 * OAuth redirect. Shopify appends a fresh id_token to the App URL on every
 * embedded load (confirmed live — see PR #6's debug output), so this can be
 * called directly from the page's own server-side render; no client-side
 * App Bridge dependency needed for the initial connection. Shopify itself
 * verifies the token's signature during the exchange, so we don't need to
 * independently verify it before forwarding.
 *
 * grant_type and subject_token_type are the standard RFC 8693 urn:ietf:...
 * strings, but requested_token_type for an offline token is Shopify's own
 * urn:shopify:... namespace, not the generic IETF one — confirmed live
 * after the IETF-style guess failed with oauth_error=invalid_requested_token_type.
 *
 * Only registers webhooks and runs the backfill on a genuinely new install —
 * this runs on every embedded page load (to keep the stored access token
 * current), and redoing a 90-day backfill on every visit would be wasteful
 * and risks Vercel's function timeout.
 */
export async function exchangeSessionToken(shop: string, idToken: string): Promise<void> {
  if (!isValidShopDomain(shop)) {
    throw new Error(`Invalid shop domain: ${shop}`);
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
      requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
    }),
  });

  if (!exchangeResponse.ok) {
    throw new Error(`Token exchange failed: ${exchangeResponse.status} ${await exchangeResponse.text()}`);
  }

  const { access_token: accessToken, scope } = (await exchangeResponse.json()) as {
    access_token: string;
    scope: string;
  };

  const existing = await prisma.store.findUnique({ where: { shopDomain: shop } });
  const store = await prisma.store.upsert({
    where: { shopDomain: shop },
    create: { shopDomain: shop, accessToken, scope },
    update: { accessToken, scope },
  });

  if (!existing) {
    // Best-effort, same caveats as before: shouldn't block the response,
    // and a large store's backfill could hit Vercel's function timeout.
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
  }
}
