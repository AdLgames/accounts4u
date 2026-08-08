import type { Prisma, Store } from "@prisma/client";
import { prisma } from "@/lib/db";
import { shopifyConfig } from "./config";
import { fetchAllPages } from "./rest";

type SyncableStore = Pick<Store, "id" | "shopDomain" | "accessToken">;

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

type SyncCounts = { orders: number; payouts: number; transactions: number };

async function runSync(store: SyncableStore, since: Date): Promise<SyncCounts> {
  const orders = await syncOrders(store, since);
  const { count: payouts, payoutIds } = await syncPayouts(store, since);
  const transactions = await syncTransactionsForPayouts(store, payoutIds);
  return { orders, payouts, transactions };
}

const BACKFILL_DAYS = 90;

export async function runBackfill(store: SyncableStore): Promise<SyncCounts> {
  const since = new Date();
  since.setDate(since.getDate() - BACKFILL_DAYS);
  return runSync(store, since);
}

/** Backup for best-effort webhooks (PLAN.md Phase 2) — re-pulls a trailing window so anything a missed webhook dropped still lands. */
export async function runSyncSweep(store: SyncableStore, sinceHours = 48): Promise<SyncCounts> {
  const since = new Date();
  since.setHours(since.getHours() - sinceHours);
  return runSync(store, since);
}
