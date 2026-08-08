import { createHmac, timingSafeEqual } from "node:crypto";

export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Verifies the X-Shopify-Hmac-Sha256 header on an incoming webhook. rawBody must be the exact, unparsed request body. */
export function verifyWebhookHmac(rawBody: string, hmacHeader: string | null, secret: string): boolean {
  if (!hmacHeader) return false;
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  return safeCompare(digest, hmacHeader);
}
