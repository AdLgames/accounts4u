import { prisma } from "../db";
import { add, minorUnits, type MinorUnits } from "../money";

/**
 * Matches order line_items' product_id against ProductCost.costPerUnit for
 * the given set of order IDs. Untracked-cost products silently contribute
 * $0 COGS (no entry in ProductCost for that product). orderIds is
 * typically "every order behind this period's payouts" — see callers in
 * profit-and-loss.ts.
 */
export async function computeCogs(storeId: string, orderIds: Set<string>): Promise<MinorUnits> {
  if (orderIds.size === 0) return minorUnits(0);

  const [orders, productCosts] = await Promise.all([
    prisma.rawOrder.findMany({ where: { storeId, shopifyId: { in: [...orderIds] } } }),
    prisma.productCost.findMany({ where: { storeId } }),
  ]);
  const costByProductId = new Map(productCosts.map((cost) => [cost.shopifyProductId, cost.costPerUnit]));

  let total = minorUnits(0);
  const seenOrderIds = new Set<string>();
  for (const order of orders) {
    if (seenOrderIds.has(order.shopifyId)) continue;
    seenOrderIds.add(order.shopifyId);

    const payload = order.payload as { line_items?: Array<{ product_id?: number | string | null; quantity?: number }> } | null;
    for (const item of payload?.line_items ?? []) {
      if (item.product_id == null) continue;
      const cost = costByProductId.get(String(item.product_id));
      if (cost == null) continue;
      total = add(total, minorUnits(cost * (item.quantity ?? 1)));
    }
  }

  return total;
}
