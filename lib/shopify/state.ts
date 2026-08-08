import { createHmac, randomBytes } from "node:crypto";
import { safeCompare } from "./hmac";

const MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Signed, stateless CSRF state for the OAuth install step — not a cookie.
 * This app is embedded (loaded in an iframe inside Shopify admin), and
 * third-party cookies set from inside that iframe aren't reliably readable
 * once the browser navigates to the top-level callback after breaking out
 * (Safari ITP blocks/expires them; Chrome is phasing them out too). Binding
 * the signature to the shop domain and a timestamp gets the same CSRF/replay
 * protection a cookie-tracked nonce would, without needing one.
 */
// "|" (not "." — shop domains contain dots) separates fields before signing.
export function createState(shop: string, secret: string): string {
  const nonce = randomBytes(8).toString("hex");
  const payload = `${shop}|${Date.now()}|${nonce}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}|${signature}`).toString("base64url");
}

export function verifyState(state: string, shop: string, secret: string): boolean {
  let decoded: string;
  try {
    decoded = Buffer.from(state, "base64url").toString("utf8");
  } catch {
    return false;
  }

  const parts = decoded.split("|");
  if (parts.length !== 4) return false;
  const [stateShop, timestampStr, nonce, signature] = parts;

  if (stateShop !== shop) return false;

  const timestamp = Number(timestampStr);
  if (!Number.isFinite(timestamp) || Date.now() - timestamp > MAX_AGE_MS) return false;

  const payload = `${stateShop}|${timestampStr}|${nonce}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  return safeCompare(expected, signature);
}
