import { createHmac, timingSafeEqual } from "node:crypto";

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verifies the `hmac` param Shopify attaches to OAuth install/callback
 * requests. Operates on the raw (still percent-encoded) query string rather
 * than a re-serialized URLSearchParams, since re-encoding can change which
 * bytes get signed. Not exercised against a live Shopify request yet — this
 * sandbox can't reach Shopify's servers, so re-verify against a real install
 * once a dev store is connected.
 */
export function verifyQueryHmac(rawQuery: string, secret: string): boolean {
  const params = new URLSearchParams(rawQuery);
  const hmac = params.get("hmac");
  if (!hmac) return false;

  const message = rawQuery
    .split("&")
    .filter((pair) => pair && !pair.startsWith("hmac=") && !pair.startsWith("signature="))
    .sort()
    .join("&");

  const digest = createHmac("sha256", secret).update(message).digest("hex");
  return safeCompare(digest, hmac);
}

/** Verifies the X-Shopify-Hmac-Sha256 header on an incoming webhook. rawBody must be the exact, unparsed request body. */
export function verifyWebhookHmac(rawBody: string, hmacHeader: string | null, secret: string): boolean {
  if (!hmacHeader) return false;
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  return safeCompare(digest, hmacHeader);
}
