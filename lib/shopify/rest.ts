/**
 * Follows Shopify's REST `Link` header pagination, calling onPage with each
 * page's items as they arrive rather than buffering the whole resource in
 * memory.
 */
export async function fetchAllPages(
  initialUrl: URL,
  accessToken: string,
  resourceKey: string,
  onPage: (items: Record<string, unknown>[]) => Promise<void>,
): Promise<void> {
  let url: URL | null = initialUrl;
  while (url) {
    const response = await fetch(url, {
      headers: { "X-Shopify-Access-Token": accessToken },
    });
    if (!response.ok) {
      throw new Error(`Shopify REST request to ${url.pathname} failed: ${response.status} ${await response.text()}`);
    }
    const body = (await response.json()) as Record<string, Record<string, unknown>[]>;
    await onPage(body[resourceKey] ?? []);
    url = nextPageUrl(response.headers.get("link"));
  }
}

function nextPageUrl(linkHeader: string | null): URL | null {
  if (!linkHeader) return null;
  const match = /<([^>]+)>;\s*rel="next"/.exec(linkHeader);
  return match ? new URL(match[1]) : null;
}
