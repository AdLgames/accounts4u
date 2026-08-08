import Link from "next/link";
import { formatDecimal } from "@/lib/money";
import { resolveCurrentStore } from "@/lib/shopify/current-store";
import { listPayouts } from "@/lib/dashboard/payouts";
import { AppNav } from "../_components/app-nav";
import { NotConnected } from "../_components/not-connected";
import { TrialBanner } from "../_components/trial-banner";
import { firstParam } from "../_lib/search-params";

export default async function PayoutsPage({ searchParams }: PageProps<"/payouts">) {
  const params = await searchParams;
  const shop = firstParam(params.shop);
  const idToken = firstParam(params.id_token);

  const store = await resolveCurrentStore(shop, idToken);
  if (!store || !shop) {
    return <NotConnected />;
  }

  const payouts = await listPayouts(store.id);

  return (
    <div className="flex min-h-full flex-col">
      <AppNav shop={shop} current="/payouts" />
      <TrialBanner shop={shop} trialEndsAt={store.trialEndsAt} subscriptionStatus={store.subscriptionStatus} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold">Payouts</h1>

        {payouts.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            No payouts yet — they&apos;ll show up here once Shopify deposits money to your bank account.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-black/10 dark:divide-white/10">
            {payouts.map((payout) => (
              <li key={payout.id}>
                <Link
                  href={`/payouts/${encodeURIComponent(payout.id)}?shop=${encodeURIComponent(shop)}`}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {payout.date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                  </span>
                  <span className="text-lg font-medium">
                    {payout.currency} {formatDecimal(payout.amount)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
