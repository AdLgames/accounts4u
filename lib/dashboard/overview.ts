import { prisma } from "@/lib/db";
import { minorUnits } from "@/lib/money";
import type { MinorUnits } from "@/lib/money";
import { explainPayout } from "@/lib/recon/explain-payout";
import { balanceTransactionFromRaw, payoutFromRaw } from "@/lib/recon/from-raw";

export interface MonthlyOverview {
  /** "YYYY-MM", UTC. */
  month: string;
  currency: string | null;
  netFromPayouts: MinorUnits;
  cogs: MinorUnits;
  adSpend: MinorUnits;
  recurringExpenses: MinorUnits;
  trueProfit: MinorUnits;
  taxSetAside: MinorUnits;
  payoutCount: number;
  unexplainedPayoutCount: number;
  lastPayout: { date: Date; amount: MinorUnits; currency: string } | null;
}

/**
 * "This month" is defined by payout date, not order date — orders placed
 * this month might not actually be paid out until next month, and fees/
 * refunds only exist in payout data, not order data. Keeping everything
 * anchored to "payouts deposited this calendar month" avoids mixing two
 * different periods together. COGS is correlated against exactly the
 * orders referenced by those payouts' transactions, for the same reason.
 *
 * PLAN.md's Overview spec calls for "next payout expected" — that's not
 * buildable from what's actually synced (Shopify doesn't expose a payout
 * schedule/forecast via the endpoints this app reads), so this reports the
 * last payout instead rather than fabricating a prediction.
 */
export async function buildMonthlyOverview(storeId: string, now = new Date()): Promise<MonthlyOverview> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const month = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`;

  const [settings, payoutRows, transactionRows] = await Promise.all([
    prisma.storeSettings.upsert({ where: { storeId }, create: { storeId }, update: {} }),
    prisma.rawPayout.findMany({ where: { storeId }, orderBy: { receivedAt: "desc" } }),
    prisma.rawTransaction.findMany({ where: { storeId } }),
  ]);

  // De-dupe append-only rows by shopifyId, keeping the most recently received.
  const seenPayoutIds = new Set<string>();
  const payouts: Array<{ shopifyId: string; payout: ReturnType<typeof payoutFromRaw> }> = [];
  for (const row of payoutRows) {
    if (seenPayoutIds.has(row.shopifyId)) continue;
    seenPayoutIds.add(row.shopifyId);
    payouts.push({ shopifyId: row.shopifyId, payout: payoutFromRaw(row.payload as Record<string, unknown>) });
  }

  const lastPayout = payouts.reduce<(typeof payouts)[number] | null>(
    (latest, current) => (!latest || current.payout.date > latest.payout.date ? current : latest),
    null,
  );

  const thisMonthPayouts = payouts.filter((p) => p.payout.date >= monthStart && p.payout.date < monthEnd);
  const transactionPayloads = transactionRows.map((row) => row.payload as Record<string, unknown>);

  let netFromPayouts = 0;
  let unexplainedPayoutCount = 0;
  let currency: string | null = null;
  const orderIdsThisMonth = new Set<string>();

  for (const { shopifyId, payout } of thisMonthPayouts) {
    currency ??= payout.currency;
    const transactions = transactionPayloads
      .filter((payload) => String(payload.payout_id ?? "") === shopifyId)
      .map((payload) => balanceTransactionFromRaw(payload));

    const breakdown = explainPayout(payout, transactions);
    netFromPayouts += breakdown.computedTotal;
    if (!breakdown.isExplained) unexplainedPayoutCount++;
    for (const txn of transactions) {
      if (txn.sourceOrderId) orderIdsThisMonth.add(txn.sourceOrderId);
    }
  }

  const cogs = await computeCogs(storeId, orderIdsThisMonth);
  const adSpend = settings.monthlyAdSpend;
  const recurringExpenses = settings.recurringExpenses;
  const trueProfit = netFromPayouts - cogs - adSpend - recurringExpenses;
  const taxSetAside = Math.round((netFromPayouts * settings.taxSetAsidePercent) / 100);

  return {
    month,
    currency,
    netFromPayouts: minorUnits(netFromPayouts),
    cogs: minorUnits(cogs),
    adSpend: minorUnits(adSpend),
    recurringExpenses: minorUnits(recurringExpenses),
    trueProfit: minorUnits(trueProfit),
    taxSetAside: minorUnits(taxSetAside),
    payoutCount: thisMonthPayouts.length,
    unexplainedPayoutCount,
    lastPayout: lastPayout
      ? { date: lastPayout.payout.date, amount: lastPayout.payout.amount, currency: lastPayout.payout.currency }
      : null,
  };
}

async function computeCogs(storeId: string, orderIds: Set<string>): Promise<number> {
  if (orderIds.size === 0) return 0;

  const [orders, productCosts] = await Promise.all([
    prisma.rawOrder.findMany({ where: { storeId, shopifyId: { in: [...orderIds] } } }),
    prisma.productCost.findMany({ where: { storeId } }),
  ]);
  const costByProductId = new Map(productCosts.map((cost) => [cost.shopifyProductId, cost.costPerUnit]));

  let total = 0;
  const seenOrderIds = new Set<string>();
  for (const order of orders) {
    if (seenOrderIds.has(order.shopifyId)) continue;
    seenOrderIds.add(order.shopifyId);

    const payload = order.payload as { line_items?: Array<{ product_id?: number | string | null; quantity?: number }> } | null;
    for (const item of payload?.line_items ?? []) {
      if (item.product_id == null) continue;
      const cost = costByProductId.get(String(item.product_id));
      if (cost == null) continue;
      total += cost * (item.quantity ?? 1);
    }
  }

  return total;
}
