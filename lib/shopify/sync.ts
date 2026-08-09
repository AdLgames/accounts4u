import type { Prisma, Store } from "@prisma/client";
import { prisma } from "@/lib/db";
import { shopifyConfig } from "./config";
import { fetchAllPages } from "./rest";
import { getValidAccessToken } from "./token-refresh";

type SyncableStore = Pick<Store, "id" | "shopDomain" | "accessToken">;
type RefreshableSyncableStore = Pick<
  Store,
  "id" | "shopDomain" | "accessToken" | "refreshToken" | "accessTokenExpiresAt" | "lastBalanceTransactionId"
>;

// REST (not GraphQL) is used here deliberately: it returns orders/payouts in
// the same shape Shopify's webhooks send, so raw_orders/raw_payouts stay
// consistent whether a row came from backfill, sweep, or webhook.

export async function syncOrders(store: SyncableStore, since: Date): Promise<number> {
  const url = new URL(`https://${store.shopDomain}/admin/api/${shopifyConfig.apiVersion}/orders.json`);
  url.searchParams.set("status", "any");
  url.searchParams.set("created_at_min", since.toISOString());
  url.searchParams.set("limit", "250");

  let count = 0;
  await fetchAllPages(url, store.accessToken, "orders", async (items) => {
    if (items.length === 0) return;
    const result = await prisma.rawOrder.createMany({
      data: items.map((item) => ({
        storeId: store.id,
        shopifyId: String(item.id),
        payload: item as Prisma.InputJsonValue,
      })),
    });
    count += result.count;
  });
  return count;
}

export async function syncPayouts(store: SyncableStore, since: Date): Promise<{ count: number; payoutIds: string[] }> {
  const url = new URL(`https://${store.shopDomain}/admin/api/${shopifyConfig.apiVersion}/shopify_payments/payouts.json`);
  url.searchParams.set("date_min", since.toISOString().slice(0, 10));
  url.searchParams.set("limit", "250");

  let count = 0;
  const payoutIds: string[] = [];
  await fetchAllPages(url, store.accessToken, "payouts", async (items) => {
    if (items.length > 0) {
      const result = await prisma.rawPayout.createMany({
        data: items.map((item) => ({
          storeId: store.id,
          shopifyId: String(item.id),
          payload: item as Prisma.InputJsonValue,
        })),
      });
      count += result.count;
    }
    for (const item of items) payoutIds.push(String(item.id));
  });
  return { count, payoutIds };
}

/** Balance transactions are fetched per-payout so raw_transactions stays tied to the payout it reconciles against (Phase 3 needs this link). */
export async function syncTransactionsForPayouts(store: SyncableStore, payoutIds: string[]): Promise<number> {
  let count = 0;
  for (const payoutId of payoutIds) {
    const url = new URL(
      `https://${store.shopDomain}/admin/api/${shopifyConfig.apiVersion}/shopify_payments/balance/transactions.json`,
    );
    url.searchParams.set("payout_id", payoutId);
    url.searchParams.set("limit", "250");

    await fetchAllPages(url, store.accessToken, "transactions", async (items) => {
      if (items.length === 0) return;
      const result = await prisma.rawTransaction.createMany({
        data: items.map((item) => ({
          storeId: store.id,
          shopifyId: String(item.id),
          payload: item as Prisma.InputJsonValue,
        })),
      });
      count += result.count;
    });
  }
  return count;
}

/**
 * Full catalog snapshot every run, not incremental -- products.json has no
 * cheap "changed since X" query this app uses elsewhere, and product
 * catalogs at this app's target customer scale are small. Written into
 * raw_products so lib/dashboard/product-lines.ts can pull each product's
 * own product_type as a revenue-category default, instead of the merchant
 * having to categorize products again in this app that they've already
 * categorized in Shopify.
 */
export async function syncProducts(store: SyncableStore): Promise<number> {
  const url = new URL(`https://${store.shopDomain}/admin/api/${shopifyConfig.apiVersion}/products.json`);
  url.searchParams.set("limit", "250");

  let count = 0;
  await fetchAllPages(url, store.accessToken, "products", async (items) => {
    if (items.length === 0) return;
    const result = await prisma.rawProduct.createMany({
      data: items.map((item) => ({
        storeId: store.id,
        shopifyId: String(item.id),
        payload: item as Prisma.InputJsonValue,
      })),
    });
    count += result.count;
  });
  return count;
}

/**
 * Syncs balance transactions directly, independent of which payout (if any)
 * they've been bundled into -- this is what lets P&L/Cashflow recognize a
 * transaction the moment Shopify captures it, rather than waiting for it to
 * show up in syncTransactionsForPayouts via a completed payout. The
 * shopify_payments/balance/transactions.json endpoint has no date-range
 * filter (confirmed: payout_id, since_id, test are the only query params),
 * so this pages forward from the last transaction id seen (Store.
 * lastBalanceTransactionId) instead of a date window -- a fresh store with
 * no watermark yet pages its entire lifetime history on the first run.
 *
 * Writes to the same raw_transactions table syncTransactionsForPayouts
 * already writes to -- it's the same Shopify resource either way, just
 * reached without the payout_id filter. Both sync paths currently coexist
 * (see PLAN.md); once this is proven live, syncTransactionsForPayouts
 * becomes redundant and can be removed as a follow-up.
 */
export async function syncBalanceTransactions(
  store: SyncableStore,
  sinceId?: string | null,
): Promise<{ count: number; maxId: string | null }> {
  const url = new URL(`https://${store.shopDomain}/admin/api/${shopifyConfig.apiVersion}/shopify_payments/balance/transactions.json`);
  url.searchParams.set("limit", "250");
  if (sinceId) url.searchParams.set("since_id", sinceId);

  let count = 0;
  let maxId: bigint | null = sinceId ? BigInt(sinceId) : null;
  await fetchAllPages(url, store.accessToken, "transactions", async (items) => {
    if (items.length === 0) return;
    const result = await prisma.rawTransaction.createMany({
      data: items.map((item) => ({
        storeId: store.id,
        shopifyId: String(item.id),
        payload: item as Prisma.InputJsonValue,
      })),
    });
    count += result.count;
    for (const item of items) {
      const id = BigInt(String(item.id));
      if (maxId === null || id > maxId) maxId = id;
    }
  });

  return { count, maxId: maxId === null ? null : String(maxId) };
}

type SyncCounts = { orders: number; payouts: number; transactions: number; products: number };

async function runSync(store: RefreshableSyncableStore, since: Date): Promise<SyncCounts> {
  // Refreshes first if the stored access token is expired or close to it —
  // this is what makes the cron sweep (which can run long after the
  // 60-minute token lifetime) actually keep working.
  const accessToken = await getValidAccessToken(store);
  const freshStore: SyncableStore = { id: store.id, shopDomain: store.shopDomain, accessToken };

  const orders = await syncOrders(freshStore, since);
  const { count: payouts, payoutIds } = await syncPayouts(freshStore, since);
  const payoutTransactions = await syncTransactionsForPayouts(freshStore, payoutIds);
  const products = await syncProducts(freshStore);

  const { count: capturedTransactions, maxId } = await syncBalanceTransactions(freshStore, store.lastBalanceTransactionId);
  if (maxId && maxId !== store.lastBalanceTransactionId) {
    await prisma.store.update({ where: { id: store.id }, data: { lastBalanceTransactionId: maxId } });
  }

  return { orders, payouts, transactions: payoutTransactions + capturedTransactions, products };
}

const BACKFILL_DAYS = 90;

export async function runBackfill(store: RefreshableSyncableStore): Promise<SyncCounts> {
  const since = new Date();
  since.setDate(since.getDate() - BACKFILL_DAYS);
  return runSync(store, since);
}

/** Backup for best-effort webhooks (PLAN.md Phase 2) — re-pulls a trailing window so anything a missed webhook dropped still lands. */
export async function runSyncSweep(store: RefreshableSyncableStore, sinceHours = 48): Promise<SyncCounts> {
  const since = new Date();
  since.setHours(since.getHours() - sinceHours);
  return runSync(store, since);
}
