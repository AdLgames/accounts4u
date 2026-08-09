import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { isValidShopDomain } from "@/lib/shopify/domain";
import { runSyncSweep } from "@/lib/shopify/sync";

// Protects against duplicate raw rows and unnecessary Shopify API calls
// from repeated clicks -- the sweep re-pulls a 48h trailing window every
// time, and raw_orders/raw_payouts/raw_transactions have no dedup-on-write
// (append-only by design, per CLAUDE.md; reads always take the
// most-recently-synced row). Bounds worst-case growth to a fixed rate no
// matter how often the button is clicked.
const COOLDOWN_MS = 2 * 60 * 1000;

/** Merchant-triggered on-demand sync for their own store, from the "Refresh" button in AppNav. Same runSyncSweep the cron uses, just scoped to one store and reachable from the dashboard instead of Vercel Cron's CRON_SECRET. */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const shop = String(formData.get("shop") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/");

  if (!isValidShopDomain(shop)) {
    return NextResponse.json({ error: "Invalid shop parameter" }, { status: 400 });
  }

  const store = await prisma.store.findUnique({ where: { shopDomain: shop } });
  if (!store) {
    return NextResponse.json({ error: "Unknown store" }, { status: 404 });
  }

  const returnUrl = new URL(redirectTo.startsWith("/") ? redirectTo : "/", request.url);
  returnUrl.searchParams.set("shop", shop);

  if (store.lastSyncAt && Date.now() - store.lastSyncAt.getTime() < COOLDOWN_MS) {
    returnUrl.searchParams.set("refreshed", "cooldown");
    return NextResponse.redirect(returnUrl, { status: 303 });
  }

  try {
    await runSyncSweep(store);
    await prisma.store.update({ where: { id: store.id }, data: { lastSyncAt: new Date(), lastSyncError: null } });
    returnUrl.searchParams.set("refreshed", "synced");
  } catch (error) {
    console.error(`Manual refresh failed for ${shop}:`, error);
    Sentry.captureException(error, { tags: { shop } });
    await prisma.store.update({
      where: { id: store.id },
      data: { lastSyncAt: new Date(), lastSyncError: String(error).slice(0, 1000) },
    });
    returnUrl.searchParams.set("refreshed", "error");
  }

  return NextResponse.redirect(returnUrl, { status: 303 });
}
