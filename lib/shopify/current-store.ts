import type { Store } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isValidShopDomain } from "./domain";
import { exchangeSessionToken } from "./session";

/**
 * Resolves which Store a dashboard page request belongs to. Shopify only
 * appends a fresh id_token to the App URL on the *initial* embedded load
 * (see lib/shopify/session.ts) — internal navigation between our own
 * dashboard routes doesn't get a new one, so the sidebar nav (app/
 * _components/sidebar.tsx) carries `shop` alone forward on its links and
 * this just looks the store up by domain on
 * those subsequent requests, re-exchanging only when id_token is present.
 */
export async function resolveCurrentStore(shop: string | undefined, idToken: string | undefined): Promise<Store | null> {
  if (!shop || !isValidShopDomain(shop)) {
    return null;
  }

  if (idToken) {
    try {
      await exchangeSessionToken(shop, idToken);
    } catch (error) {
      console.error(`exchangeSessionToken failed for ${shop}:`, error);
    }
  }

  return prisma.store.findUnique({ where: { shopDomain: shop } });
}
