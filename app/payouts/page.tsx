import Link from "next/link";
import { formatDecimal } from "@/lib/money";
import { resolveCurrentStore } from "@/lib/shopify/current-store";
import { listPayouts } from "@/lib/dashboard/payouts";
import { AppShell } from "../_components/app-shell";
import { Card } from "../_components/card";
import { NotConnected } from "../_components/not-connected";
import { RefreshStatus } from "../_components/refresh-status";
import { TrialBanner } from "../_components/trial-banner";
import { firstParam } from "../_lib/search-params";

export default async function PayoutsPage({ searchParams }: PageProps<"/payouts">) {
  const params = await searchParams;
  const shop = firstParam(params.shop);
  const idToken = firstParam(params.id_token);
  const refreshed = firstParam(params.refreshed);

  const store = await resolveCurrentStore(shop, idToken, "/payouts");
  if (!store || !shop) {
    return <NotConnected />;
  }

  const payouts = await listPayouts(store.id);

  return (
    <AppShell
      shop={shop}
      current="/payouts"
      title="Payouts"
      subtitle="Shopify Payments deposits"
      lastSyncAt={store.lastSyncAt}
      banner={
        <>
          <RefreshStatus status={refreshed} />
          <TrialBanner shop={shop} trialEndsAt={store.trialEndsAt} subscriptionStatus={store.subscriptionStatus} />
        </>
      }
    >
      <div className="mx-auto w-full max-w-4xl">
        {payouts.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No payouts yet — they&apos;ll show up here once Shopify deposits money to your bank account.
          </p>
        ) : (
          <Card className="overflow-hidden">
            <ul className="flex flex-col divide-y divide-black/5 dark:divide-white/5">
              {payouts.map((payout) => (
                <li key={payout.id}>
                  <Link
                    href={`/payouts/${encodeURIComponent(payout.id)}?shop=${encodeURIComponent(shop)}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {payout.date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <span className="font-mono text-base font-semibold">
                      {payout.currency} {formatDecimal(payout.amount)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
