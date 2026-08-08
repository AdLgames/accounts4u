import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { shopifyConfig } from "@/lib/shopify/config";
import { isValidShopDomain } from "@/lib/shopify/domain";
import { buildAuthorizeUrl } from "@/lib/shopify/oauth";

const STATE_COOKIE = "shopify_oauth_state";

export async function GET(request: NextRequest) {
  const shop = request.nextUrl.searchParams.get("shop");
  if (!shop || !isValidShopDomain(shop)) {
    return NextResponse.json({ error: "Invalid or missing shop parameter" }, { status: 400 });
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/shopify/callback", shopifyConfig.appUrl).toString();
  const authorizeUrl = buildAuthorizeUrl(shop, state, redirectUri);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
