import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { runSyncSweep } from "@/lib/shopify/sync";

/**
 * Scheduled reconciliation sweep (PLAN.md Phase 2): re-pulls a trailing
 * window for every connected store, as a backup for best-effort webhooks.
 * Wired to Vercel Cron in vercel.json, authenticated via CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stores = await prisma.store.findMany();
  const results = [];
  for (const store of stores) {
    try {
      const counts = await runSyncSweep(store);
      await prisma.store.update({
        where: { id: store.id },
        data: { lastSyncAt: new Date(), lastSyncError: null },
      });
      results.push({ shopDomain: store.shopDomain, ...counts });
    } catch (error) {
      console.error(`runSyncSweep failed for ${store.shopDomain}:`, error);
      Sentry.captureException(error, { tags: { shop: store.shopDomain } });
      await prisma.store.update({
        where: { id: store.id },
        data: { lastSyncAt: new Date(), lastSyncError: String(error).slice(0, 1000) },
      });
      results.push({ shopDomain: store.shopDomain, error: String(error) });
    }
  }

  return NextResponse.json({ results });
}
