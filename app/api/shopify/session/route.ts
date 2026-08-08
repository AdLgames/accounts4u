import { NextRequest, NextResponse } from "next/server";
import { isValidShopDomain } from "@/lib/shopify/domain";
import { exchangeSessionToken } from "@/lib/shopify/session";

/**
 * Client-driven session exchange — used if the app ever needs to refresh
 * the connection mid-session (e.g. calling window.shopify.idToken() again
 * after the URL's initial id_token has expired). The primary install path
 * is app/page.tsx doing this server-side using the id_token Shopify already
 * puts on the URL.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as { shop?: string; idToken?: string };
  const { shop, idToken } = body;

  if (!shop || !isValidShopDomain(shop) || !idToken) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    await exchangeSessionToken(shop, idToken);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`Session exchange failed for ${shop}:`, error);
    return NextResponse.json({ error: "Token exchange failed" }, { status: 502 });
  }
}
