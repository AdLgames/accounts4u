import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { shopifyConfig } from "@/lib/shopify/config";
import { verifyWebhookHmac } from "@/lib/shopify/hmac";

// Delivery headers use the REST-style topic string even for subscriptions
// registered via the GraphQL ORDERS_CREATE/REFUNDS_CREATE enum values.
const TOPIC_TABLE = {
  "orders/create": "rawOrder",
  "refunds/create": "rawTransaction",
} as const;

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");
  if (!verifyWebhookHmac(rawBody, hmacHeader, shopifyConfig.apiSecret)) {
    return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
  }

  const topic = request.headers.get("x-shopify-topic") ?? "";
  const shopDomain = request.headers.get("x-shopify-shop-domain");
  if (!shopDomain) {
    return NextResponse.json({ error: "Missing shop domain" }, { status: 400 });
  }

  const store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store) {
    // Unknown store (e.g. uninstalled) — acknowledge so Shopify stops retrying.
    return NextResponse.json({ ok: true });
  }

  const payload = JSON.parse(rawBody) as Record<string, unknown>;
  const shopifyId = String(payload.id ?? payload.admin_graphql_api_id ?? "unknown");

  const table = TOPIC_TABLE[topic as keyof typeof TOPIC_TABLE];
  if (table === "rawOrder") {
    await prisma.rawOrder.create({
      data: { storeId: store.id, shopifyId, payload: payload as Prisma.InputJsonValue },
    });
  } else if (table === "rawTransaction") {
    await prisma.rawTransaction.create({
      data: { storeId: store.id, shopifyId, payload: payload as Prisma.InputJsonValue },
    });
  }
  // Unrecognized topics are acknowledged and dropped rather than erroring,
  // so Shopify doesn't retry-storm this endpoint if a topic gets subscribed
  // some other way later.

  return NextResponse.json({ ok: true });
}
