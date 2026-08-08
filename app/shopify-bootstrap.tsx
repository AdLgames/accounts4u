"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    shopify?: { idToken: () => Promise<string> };
  }
}

type Status = "idle" | "connected" | "error";

/**
 * Runs on every load inside Shopify admin's iframe: gets a fresh signed
 * session token from App Bridge and exchanges it server-side for an access
 * token (see /api/shopify/session). This is the embedded-app pattern —
 * no OAuth redirect, no cookies, since this app is registered with the
 * legacy install flow disabled.
 */
export function ShopifyBootstrap() {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    const shop = new URLSearchParams(window.location.search).get("shop");
    if (!shop || !window.shopify) return;

    let cancelled = false;

    window.shopify
      .idToken()
      .then((idToken) =>
        fetch("/api/shopify/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shop, idToken }),
        }),
      )
      .then((response) => {
        if (!cancelled) setStatus(response.ok ? "connected" : "error");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "idle") return null;
  if (status === "error") return <p>Couldn&apos;t connect to Shopify. Try reloading the app.</p>;
  return <p>Connected to Shopify.</p>;
}
