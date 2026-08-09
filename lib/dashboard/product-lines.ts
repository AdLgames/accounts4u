import { prisma } from "../db";
import { add, minorUnits, parseDecimal, subtract, type MinorUnits } from "../money";

export interface ProductLine {
  productId: string;
  title: string;
  category: string | null;
  quantity: number;
  revenue: MinorUnits;
  cogs: MinorUnits;
  grossProfit: MinorUnits;
}

interface RawLineItem {
  product_id?: number | string | null;
  title?: string;
  price?: string | number;
  quantity?: number;
}

/**
 * One pass over this period's orders, replacing the old cogs.ts's narrower
 * role: per-product revenue (from line_items[].price * quantity --
 * pre-discount/pre-refund, see the caveat this feeds into P&L's UI with),
 * COGS (via ProductCost.costPerUnit), and revenueCategory (via
 * ProductCost.revenueCategory). Untracked-cost products contribute £0
 * COGS, same silent-zero convention the old cogs.ts used.
 */
export async function computeProductLines(storeId: string, orderIds: Set<string>): Promise<ProductLine[]> {
  if (orderIds.size === 0) return [];

  const [orders, productCosts] = await Promise.all([
    prisma.rawOrder.findMany({ where: { storeId, shopifyId: { in: [...orderIds] } } }),
    prisma.productCost.findMany({ where: { storeId } }),
  ]);
  const costByProductId = new Map(productCosts.map((cost) => [cost.shopifyProductId, cost]));

  const lines = new Map<string, ProductLine>();
  const seenOrderIds = new Set<string>();
  for (const order of orders) {
    if (seenOrderIds.has(order.shopifyId)) continue;
    seenOrderIds.add(order.shopifyId);

    const payload = order.payload as { line_items?: RawLineItem[] } | null;
    for (const item of payload?.line_items ?? []) {
      if (item.product_id == null) continue;
      const productId = String(item.product_id);
      const quantity = item.quantity ?? 1;
      const revenue = minorUnits(parseDecimal(String(item.price ?? "0")) * quantity);
      const cost = costByProductId.get(productId);
      const cogsAmount = minorUnits(cost ? cost.costPerUnit * quantity : 0);

      const existing = lines.get(productId);
      if (existing) {
        existing.quantity += quantity;
        existing.revenue = add(existing.revenue, revenue);
        existing.cogs = add(existing.cogs, cogsAmount);
        existing.grossProfit = subtract(existing.revenue, existing.cogs);
      } else {
        lines.set(productId, {
          productId,
          title: String(item.title ?? "Untitled product"),
          category: cost?.revenueCategory ?? null,
          quantity,
          revenue,
          cogs: cogsAmount,
          grossProfit: subtract(revenue, cogsAmount),
        });
      }
    }
  }

  return [...lines.values()].sort((a, b) => b.revenue - a.revenue);
}
