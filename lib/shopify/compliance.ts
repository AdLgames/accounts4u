import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const REDACTED = "[redacted]";

/**
 * Deletes every row of data associated with a shop, in dependency order.
 * The raw data, settings, and product cost tables use ON DELETE RESTRICT
 * rather than CASCADE deliberately (a plain DB cascade felt too easy to
 * trigger by accident for data this significant) — this handler is the one
 * place meant to actually do it. Shopify sends this ~48 hours after uninstall.
 */
export async function handleShopRedact(shopDomain: string, payload: Record<string, unknown>): Promise<void> {
  await prisma.complianceRequest.create({
    data: { shopDomain, type: "shop/redact", payload: payload as Prisma.InputJsonValue },
  });

  const store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store) return; // already gone, or never really installed

  await prisma.$transaction([
    prisma.rawOrder.deleteMany({ where: { storeId: store.id } }),
    prisma.rawTransaction.deleteMany({ where: { storeId: store.id } }),
    prisma.rawPayout.deleteMany({ where: { storeId: store.id } }),
    prisma.productCost.deleteMany({ where: { storeId: store.id } }),
    prisma.storeSettings.deleteMany({ where: { storeId: store.id } }),
    prisma.store.delete({ where: { id: store.id } }),
  ]);
}

/**
 * Scrubs customer-identifying fields from the raw order payloads Shopify
 * says need redacting, while preserving financial figures (order id,
 * totals, dates, line items) — reconciliation still needs those. Redacts
 * every stored row for each order id, since raw_orders is append-only and
 * a re-sync can leave more than one row per order.
 *
 * The PII field paths covered (email/phone/name/address at the order,
 * customer, billing_address, and shipping_address levels) are the
 * well-documented standard set, not verified against a live redact
 * request — review before relying on this for real compliance.
 */
export async function handleCustomersRedact(shopDomain: string, payload: Record<string, unknown>): Promise<void> {
  await prisma.complianceRequest.create({
    data: { shopDomain, type: "customers/redact", payload: payload as Prisma.InputJsonValue },
  });

  const store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store) return;

  const ordersToRedact = Array.isArray(payload.orders_to_redact) ? (payload.orders_to_redact as unknown[]) : [];
  const orderIds = ordersToRedact.map(String);
  if (orderIds.length === 0) return;

  const rows = await prisma.rawOrder.findMany({ where: { storeId: store.id, shopifyId: { in: orderIds } } });
  for (const row of rows) {
    const redacted = redactOrderPii(row.payload as Record<string, unknown>);
    await prisma.rawOrder.update({ where: { id: row.id }, data: { payload: redacted as Prisma.InputJsonValue } });
  }
}

/**
 * No self-service export is built yet, so this just logs the request for
 * manual fulfillment — Shopify requires a timely response, not necessarily
 * instant automation.
 */
export async function handleCustomersDataRequest(shopDomain: string, payload: Record<string, unknown>): Promise<void> {
  await prisma.complianceRequest.create({
    data: { shopDomain, type: "customers/data_request", payload: payload as Prisma.InputJsonValue },
  });
}

const PII_KEYS = [
  "email",
  "phone",
  "first_name",
  "last_name",
  "name",
  "address1",
  "address2",
  "city",
  "zip",
  "province",
  "company",
];

function redactOrderPii(order: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...order };

  for (const key of ["email", "phone"]) {
    if (redacted[key] != null) redacted[key] = REDACTED;
  }

  redacted.customer = redactObject(redacted.customer);
  redacted.billing_address = redactObject(redacted.billing_address);
  redacted.shipping_address = redactObject(redacted.shipping_address);

  return redacted;
}

function redactObject(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  const obj = { ...(value as Record<string, unknown>) };
  for (const key of PII_KEYS) {
    if (obj[key] != null) obj[key] = REDACTED;
  }
  if ("default_address" in obj) {
    obj.default_address = redactObject(obj.default_address);
  }
  return obj;
}
