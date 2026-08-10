import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { safeCompare } from "./hmac";

const COOKIE_NAME = "a4_session";
// Generous but bounded -- Shopify re-issues a fresh id_token on the next
// embedded reload regardless, which re-mints this cookie, so there's no
// real cost to keeping the window short-ish rather than indefinite.
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface AppSession {
  storeId: string;
  shop: string;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Pure, unit-tested -- HMAC-signs {storeId, shop, exp} into a compact, URL-safe cookie value. */
export function encodeSessionToken(session: AppSession, expiresAt: number, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ ...session, exp: expiresAt })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * Pure, unit-tested -- verifies the signature (constant-time comparison,
 * not `===`) and expiry before trusting the payload. Returns null on any
 * forgery, tampering, malformed input, or expiry -- callers treat that
 * identically to "no session at all", never fall back to trusting
 * anything else about the request.
 */
export function decodeSessionToken(value: string, secret: string, now = Date.now()): AppSession | null {
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeCompare(sign(payload, secret), signature)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<AppSession & { exp: number }>;
    if (typeof parsed.exp !== "number" || parsed.exp < now) return null;
    if (typeof parsed.storeId !== "string" || typeof parsed.shop !== "string") return null;
    return { storeId: parsed.storeId, shop: parsed.shop };
  } catch {
    return null;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Mints the app's own session cookie -- the ONE place trust gets
 * established, called only after Shopify has verified an id_token via
 * Token Exchange (lib/shopify/session.ts, see app/api/shopify/session/
 * bounce/route.ts). Every other request re-derives `storeId` from this
 * cookie (readAppSession), never from a bare `shop` query parameter,
 * which proves nothing about who's asking -- see the security review
 * that found exactly that gap.
 *
 * SameSite=None+Secure since this app runs embedded in Shopify admin's
 * iframe, a different origin than this app's own -- a default/Lax cookie
 * would never be sent there. HMAC-signed (not encrypted) since the
 * payload (a storeId and shop domain) isn't sensitive on its own; what
 * matters is that it can't be forged or tampered with.
 */
export function setAppSessionCookie(response: NextResponse, storeId: string, shop: string): void {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  response.cookies.set(COOKIE_NAME, encodeSessionToken({ storeId, shop }, expiresAt, requireEnv("SESSION_SECRET")), {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    expires: new Date(expiresAt),
  });
}

/** Reads and verifies the app session cookie. Returns null if missing, malformed, forged, or expired -- callers treat that as "not authenticated", never as "trust the shop param instead". */
export async function readAppSession(): Promise<AppSession | null> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) return null;
  return decodeSessionToken(value, requireEnv("SESSION_SECRET"));
}
