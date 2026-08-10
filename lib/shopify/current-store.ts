import type { Store } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { readAppSession } from "./app-session";
import { isValidShopDomain } from "./domain";

/**
 * Resolves which Store a dashboard page request belongs to -- and the
 * ONLY things allowed to establish that are Shopify's own verified
 * id_token (via Token Exchange) or this app's own signed session cookie
 * minted from a prior verified exchange (lib/shopify/app-session.ts). A
 * bare `shop` query parameter proves nothing about who's asking and must
 * never be trusted on its own to resolve a Store -- a security review
 * found exactly that gap here (and in every Server Action that closed
 * over the storeId this used to return unconditionally, and in the
 * Stripe checkout/portal routes, both fixed alongside this).
 *
 * Shopify only appends a fresh id_token to the App URL on the *initial*
 * embedded load. A Server Component can't set cookies directly -- only a
 * Server Action or Route Handler can -- so a request carrying id_token
 * gets bounced through /api/shopify/session/bounce, which does the real
 * exchange, mints the session cookie, and redirects back to
 * `currentPath` without id_token on the URL. Internal navigation and
 * Server Action redirects never carry id_token, so from then on every
 * request on this visit is authenticated purely by the cookie.
 */
export async function resolveCurrentStore(
  shop: string | undefined,
  idToken: string | undefined,
  currentPath: string,
): Promise<Store | null> {
  if (!shop || !isValidShopDomain(shop)) {
    return null;
  }

  if (idToken) {
    redirect(
      `/api/shopify/session/bounce?shop=${encodeURIComponent(shop)}&id_token=${encodeURIComponent(idToken)}&redirectTo=${encodeURIComponent(currentPath)}`,
    );
  }

  const session = await readAppSession();
  if (!session || session.shop !== shop) {
    return null;
  }
  return prisma.store.findUnique({ where: { id: session.storeId } });
}

/**
 * For Route Handlers that don't render a page and so never receive a
 * fresh id_token (Stripe checkout/portal, manual refresh) -- the
 * merchant always already has a session cookie by the time they click
 * something like "Subscribe" or "Refresh", since reaching that button
 * requires having loaded a dashboard page first. Resolves purely from
 * the verified session cookie, cross-checked against the requested
 * `shop` so a stale or mismatched cookie can't act on the wrong store.
 */
export async function resolveAuthenticatedStore(shop: string | undefined): Promise<Store | null> {
  if (!shop || !isValidShopDomain(shop)) {
    return null;
  }
  const session = await readAppSession();
  if (!session || session.shop !== shop) {
    return null;
  }
  return prisma.store.findUnique({ where: { id: session.storeId } });
}
