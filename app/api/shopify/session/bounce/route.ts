import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setAppSessionCookie } from "@/lib/shopify/app-session";
import { isValidShopDomain } from "@/lib/shopify/domain";
import { exchangeSessionToken } from "@/lib/shopify/session";

/**
 * The only place this app's session cookie gets minted. A Server
 * Component (every dashboard page) can't set cookies directly -- Next.js
 * only allows cookie writes from a Server Action or Route Handler -- so
 * lib/shopify/current-store.ts's resolveCurrentStore redirects here
 * whenever a request carries a fresh id_token (the initial embedded
 * load; Shopify only attaches it there, never on internal navigation).
 * This does the real Shopify-verified exchange, mints the cookie, and
 * redirects back to the originally-requested page WITHOUT id_token on
 * the URL -- keeps it out of browser history and means every subsequent
 * request on this visit is authenticated by the cookie, not by a bare
 * `shop` query parameter (which proves nothing on its own -- see the
 * security review that found exactly that gap in every page and Server
 * Action, and in the Stripe checkout/portal routes).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const shop = searchParams.get("shop");
  const idToken = searchParams.get("id_token");
  const redirectTo = searchParams.get("redirectTo") ?? "/";

  if (!shop || !isValidShopDomain(shop) || !idToken) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    await exchangeSessionToken(shop, idToken);
  } catch (error) {
    console.error(`Session bounce exchange failed for ${shop}:`, error);
    return NextResponse.json({ error: "Token exchange failed" }, { status: 502 });
  }

  const store = await prisma.store.findUnique({ where: { shopDomain: shop } });
  if (!store) {
    return NextResponse.json({ error: "Store not found after exchange" }, { status: 500 });
  }

  // Same not-an-open-redirect guard as /api/shopify/refresh: only ever
  // redirect to a relative path on this app, never an attacker-supplied host.
  const target = new URL(redirectTo.startsWith("/") ? redirectTo : "/", request.url);
  target.searchParams.set("shop", shop);

  const response = NextResponse.redirect(target, { status: 303 });
  setAppSessionCookie(response, store.id, shop);
  return response;
}
