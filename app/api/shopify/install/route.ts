import { NextRequest, NextResponse } from "next/server";
import { shopifyConfig } from "@/lib/shopify/config";
import { isValidShopDomain } from "@/lib/shopify/domain";
import { buildAuthorizeUrl } from "@/lib/shopify/oauth";
import { createState } from "@/lib/shopify/state";

export async function GET(request: NextRequest) {
  const shop = request.nextUrl.searchParams.get("shop");
  if (!shop || !isValidShopDomain(shop)) {
    return NextResponse.json({ error: "Invalid or missing shop parameter" }, { status: 400 });
  }

  const state = createState(shop, shopifyConfig.apiSecret);
  const redirectUri = new URL("/api/shopify/callback", shopifyConfig.appUrl).toString();
  const authorizeUrl = buildAuthorizeUrl(shop, state, redirectUri);

  // This route is loaded inside Shopify admin's iframe (embedded app), but
  // Shopify's OAuth consent screen refuses to render in a frame by design —
  // a server-side redirect gets silently blocked in-frame. Break out to the
  // top window with a script instead.
  const html = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Redirecting…</title></head>
  <body>
    <script>
      var url = ${JSON.stringify(authorizeUrl)};
      (window.top || window).location.href = url;
    </script>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
