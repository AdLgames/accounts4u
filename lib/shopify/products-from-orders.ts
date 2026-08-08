import { prisma } from "@/lib/db";

export interface ProductSummary {
  productId: string;
  title: string;
}

interface OrderLineItem {
  product_id?: number | string | null;
  title?: string | null;
}

interface OrderPayload {
  line_items?: OrderLineItem[];
}

/**
 * We don't sync Shopify's Products resource (Phase 2's backfill only
 * covers orders/payouts/transactions), so the product list for per-product
 * COGS entry is derived from recent orders' line items instead — the
 * product IDs and titles merchants would actually recognize, without a
 * separate sync pipeline. Recent raw_orders rows can include repeat syncs
 * of the same order (append-only, per CLAUDE.md), so a fixed row limit can
 * under-cover a high-volume store's full catalog; fine for v1.
 */
export async function listProductsFromOrders(storeId: string, limit = 200): Promise<ProductSummary[]> {
  const orders = await prisma.rawOrder.findMany({
    where: { storeId },
    orderBy: { receivedAt: "desc" },
    take: limit,
    select: { payload: true },
  });

  const products = new Map<string, string>();
  for (const order of orders) {
    const payload = order.payload as OrderPayload | null;
    for (const item of payload?.line_items ?? []) {
      if (item.product_id == null) continue;
      const id = String(item.product_id);
      if (!products.has(id)) {
        products.set(id, item.title ?? id);
      }
    }
  }

  return [...products.entries()].map(([productId, title]) => ({ productId, title }));
}
