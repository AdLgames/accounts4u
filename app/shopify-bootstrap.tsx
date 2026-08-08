"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    shopify?: { idToken: () => Promise<string> };
  }
}

type Status =
  | "idle"
  | "no-shop-param"
  | "waiting-for-app-bridge"
  | "app-bridge-not-found"
  | "connecting"
  | "connected"
  | "error";

const POLL_INTERVAL_MS = 200;
const POLL_TIMEOUT_MS = 5000;

/**
 * Runs on every load inside Shopify admin's iframe: gets a fresh signed
 * session token from App Bridge and exchanges it server-side for an access
 * token (see /api/shopify/session). This is the embedded-app pattern — no
 * OAuth redirect, no cookies, since this app is registered with the legacy
 * install flow disabled.
 *
 * Polls for window.shopify rather than checking once, since the App Bridge
 * script (loaded beforeInteractive) may still be doing its own async setup
 * by the time this effect first runs. Every stopping point renders a
 * distinct, visible status instead of failing silently — this hasn't been
 * exercised against a live embedded session yet, so those messages are the
 * only way to tell what actually happened without server log access.
 */
export function ShopifyBootstrap() {
  const [status, setStatus] = useState<Status>("idle");
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    const poll = setInterval(() => {
      if (cancelled) return;

      const shop = new URLSearchParams(window.location.search).get("shop");
      if (!shop) {
        clearInterval(poll);
        setStatus("no-shop-param");
        return;
      }

      if (window.shopify) {
        clearInterval(poll);
        setStatus("connecting");
        window.shopify
          .idToken()
          .then((idToken) =>
            fetch("/api/shopify/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ shop, idToken }),
            }),
          )
          .then(async (response) => {
            if (cancelled) return;
            if (response.ok) {
              setStatus("connected");
            } else {
              setDetail(`${response.status} ${await response.text()}`);
              setStatus("error");
            }
          })
          .catch((error: unknown) => {
            if (!cancelled) {
              setDetail(String(error));
              setStatus("error");
            }
          });
        return;
      }

      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        clearInterval(poll);
        setStatus("app-bridge-not-found");
      } else {
        setStatus("waiting-for-app-bridge");
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  if (status === "idle") return null;
  if (status === "no-shop-param") return <p>Debug: no ?shop= param in the URL.</p>;
  if (status === "waiting-for-app-bridge") return <p>Waiting for Shopify App Bridge to load…</p>;
  if (status === "app-bridge-not-found") {
    return <p>Debug: window.shopify never appeared — App Bridge script may not have loaded.</p>;
  }
  if (status === "connecting") return <p>Connecting to Shopify…</p>;
  if (status === "error") {
    return <p>Couldn&apos;t connect to Shopify{detail ? `: ${detail}` : ""}. Try reloading the app.</p>;
  }
  return <p>Connected to Shopify.</p>;
}
