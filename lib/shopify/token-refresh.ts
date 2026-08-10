import type { Store } from "@prisma/client";
import { prisma } from "@/lib/db";
import { shopifyConfig } from "./config";

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

type RefreshableStore = Pick<Store, "id" | "shopDomain" | "accessToken" | "refreshToken" | "accessTokenExpiresAt">;

/**
 * Returns a valid access token for the store, refreshing it first if it's
 * expired or close to (within 5 minutes of) expiring. This is the missing
 * piece flagged since Phase 2: exchangeSessionToken gets a 60-minute
 * access token, but nothing was refreshing it before use — the cron sync
 * sweep, or any call more than an hour after a merchant's last visit,
 * would fail once the stored token expired.
 *
 * Shopify rotates both tokens on refresh (per Shopify's docs, the old
 * refresh_token stops working immediately) — both get persisted, since
 * losing the new refresh_token would be worse than not refreshing at all.
 * Same endpoint and form-encoding as the initial token exchange
 * (lib/shopify/session.ts), just grant_type=refresh_token instead.
 */
export async function getValidAccessToken(store: RefreshableStore): Promise<string> {
  if (store.accessTokenExpiresAt === null) {
    // Never been through Token Exchange -- either a row that predates this
    // app's Token Exchange rebuild, or (shouldn't happen once expiring=1 is
    // honored) an exchange response that omitted expires_in. Either way
    // this store is holding a legacy, non-expiring offline token, which
    // Shopify is actively deprecating -- confirmed live via Partner
    // Dashboard's API health monitoring flagging "Deprecated offline token
    // use detected". There's no refresh_token to rotate and no id_token to
    // re-exchange without the merchant present, so a background job can't
    // silently fix this -- stop making Shopify calls with it instead of
    // perpetuating deprecated-token traffic. Resolves itself the next time
    // the merchant opens the embedded app (exchangeSessionToken re-runs and
    // overwrites this row with an expiring token).
    throw new Error(
      `${store.shopDomain} still has a legacy (non-expiring) offline token -- ask the merchant to reopen the app once to re-authenticate.`,
    );
  }

  const needsRefresh = store.accessTokenExpiresAt.getTime() - REFRESH_MARGIN_MS < Date.now();

  if (!needsRefresh || !store.refreshToken) {
    return store.accessToken;
  }

  const body = new URLSearchParams({
    client_id: shopifyConfig.apiKey,
    client_secret: shopifyConfig.apiSecret,
    grant_type: "refresh_token",
    refresh_token: store.refreshToken,
  });

  const response = await fetch(`https://${store.shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed for ${store.shopDomain}: ${response.status} ${await response.text()}`);
  }

  const {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
    refresh_token_expires_in: refreshTokenExpiresIn,
  } = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    refresh_token_expires_in?: number;
  };

  const now = Date.now();
  await prisma.store.update({
    where: { id: store.id },
    data: {
      accessToken,
      refreshToken: refreshToken ?? store.refreshToken,
      accessTokenExpiresAt: expiresIn ? new Date(now + expiresIn * 1000) : null,
      // Omit (rather than null) when Shopify doesn't return this -- leaves
      // the previously stored expiry as-is instead of clearing it.
      ...(refreshTokenExpiresIn ? { refreshTokenExpiresAt: new Date(now + refreshTokenExpiresIn * 1000) } : {}),
    },
  });

  return accessToken;
}
