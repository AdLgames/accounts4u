import { NextResponse } from "next/server";

/**
 * A hosted checkout/payment page won't render inside a third-party iframe
 * (by design, same reason Shopify's own OAuth screen didn't — see
 * lib/shopify/session.ts's history). Used for any redirect target reached
 * from a link inside this embedded app's iframe.
 */
export function iframeBreakoutRedirect(url: string): NextResponse {
  const html = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Redirecting…</title></head>
  <body>
    <script>
      var url = ${JSON.stringify(url)};
      (window.top || window).location.href = url;
    </script>
  </body>
</html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
