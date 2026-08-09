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

interface RawProductPayload {
  product_type?: string | null;
}

/**
 * raw_products is append-only (CLAUDE.md) -- a full catalog snapshot is
 * written on every sync, so multiple rows can exist per shopifyId over
 * time. Keeps only the most-recently-received row per product, same
 * de-dupe-by-id-keep-latest pattern lib/dashboard/payout-ledger.ts uses.
 */
export async function loadShopifyProductTypes(storeId: string): Promise<Map<string, string | null>> {
  const rows = await prisma.rawProduct.findMany({
    where: { storeId },
    orderBy: { receivedAt: "desc" },
    select: { shopifyId: true, payload: true },
  });

  const types = new Map<string, string | null>();
  for (const row of rows) {
    if (types.has(row.shopifyId)) continue;
    const payload = row.payload as RawProductPayload | null;
    types.set(row.shopifyId, payload?.product_type?.trim() || null);
  }
  return types;
}

/**
 * One pass over this period's orders, replacing the old cogs.ts's narrower
 * role: per-product revenue (from line_items[].price * quantity --
 * pre-discount/pre-refund, see the caveat this feeds into P&L's UI with),
 * COGS (via ProductCost.costPerUnit), and revenueCategory. Untracked-cost
 * products contribute £0 COGS, same silent-zero convention the old cogs.ts
 * used. Category resolves ProductCost.revenueCategory (an explicit
 * merchant override) first, then falls back to the product's own Shopify
 * product_type (raw_products, synced separately) so merchants don't have
 * to categorize products a second time -- see the ProductCost.
 * revenueCategory doc comment in prisma/schema.prisma.
 */
export async function computeProductLines(storeId: string, orderIds: Set<string>): Promise<ProductLine[]> {
  if (orderIds.size === 0) return [];

  const [orders, productCosts, productTypes] = await Promise.all([
    prisma.rawOrder.findMany({ where: { storeId, shopifyId: { in: [...orderIds] } } }),
    prisma.productCost.findMany({ where: { storeId } }),
    loadShopifyProductTypes(storeId),
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
          category: cost?.revenueCategory || productTypes.get(productId) || null,
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
