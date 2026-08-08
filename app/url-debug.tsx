"use client";

import { useEffect, useState } from "react";

/** Temporary: shows the actual browser URL for this page, since a mobile
 * Shopify admin app can't see the embedded iframe's real URL in its address
 * bar. Remove once the App Bridge init issue is diagnosed. */
export function UrlDebug() {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    const url = window.location.href;
    queueMicrotask(() => setHref(url));
  }, []);

  if (!href) return null;
  return <p style={{ wordBreak: "break-all" }}>Debug URL: {href}</p>;
}
