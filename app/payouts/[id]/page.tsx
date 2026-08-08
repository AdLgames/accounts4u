import Link from "next/link";
import { formatDecimal, minorUnits } from "@/lib/money";
import type { MinorUnits } from "@/lib/money";
import { resolveCurrentStore } from "@/lib/shopify/current-store";
import { explainPayoutById } from "@/lib/dashboard/payouts";
import { AppNav } from "../../_components/app-nav";
import { NotConnected } from "../../_components/not-connected";
import { TrialBanner } from "../../_components/trial-banner";
import { firstParam } from "../../_lib/search-params";

function money(currency: string, amount: MinorUnits): string {
  return `${currency} ${formatDecimal(amount)}`;
}

export default async function PayoutDetailPage({ params, searchParams }: PageProps<"/payouts/[id]">) {
  const { id: payoutId } = await params;
  const query = await searchParams;
  const shop = firstParam(query.shop);
  const idToken = firstParam(query.id_token);

  const store = await resolveCurrentStore(shop, idToken);
  if (!store || !shop) {
    return <NotConnected />;
  }

  const breakdown = await explainPayoutById(store.id, payoutId);

  return (
    <div className="flex min-h-full flex-col">
      <AppNav shop={shop} current="/payouts" />
      <TrialBanner shop={shop} trialEndsAt={store.trialEndsAt} subscriptionStatus={store.subscriptionStatus} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <Link href={`/payouts?shop=${encodeURIComponent(shop)}`} className="text-sm text-zinc-500 hover:underline">
          ← Payouts
        </Link>

        {!breakdown ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Payout not found.</p>
        ) : (
          <>
            <h1 className="mt-2 text-2xl font-semibold">{money(breakdown.currency, breakdown.deposited)} arrived</h1>

            <dl className="mt-4 flex flex-col gap-2 text-sm">
              <Row label="Sales" value={breakdown.grossSales} currency={breakdown.currency} sign="+" />
              {breakdown.refunds !== 0 && <Row label="Refunds" value={breakdown.refunds} currency={breakdown.currency} sign="" />}
              <Row
                label="Fees"
                value={breakdown.fees}
                currency={breakdown.currency}
                sign="−"
                title="Shopify's payment processing and platform fees for this payout."
              />
              {breakdown.chargebacks !== 0 && (
                <Row
                  label="Chargebacks"
                  value={breakdown.chargebacks}
                  currency={breakdown.currency}
                  sign=""
                  title="Disputed payments (chargebacks) deducted this payout."
                />
              )}
              {breakdown.adjustments !== 0 && (
                <Row label="Adjustments" value={breakdown.adjustments} currency={breakdown.currency} sign="" />
              )}
              {breakdown.reserves !== 0 && (
                <Row
                  label="Reserve"
                  value={breakdown.reserves}
                  currency={breakdown.currency}
                  sign=""
                  title="Funds Shopify held back this cycle rather than paying out."
                />
              )}
              {breakdown.other !== 0 && <Row label="Other" value={breakdown.other} currency={breakdown.currency} sign="" />}
            </dl>

            {!breakdown.isExplained && (
              <p className="mt-4 rounded border border-amber-400/50 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                This payout doesn&apos;t fully add up yet — {money(breakdown.currency, breakdown.residual)} unexplained. Nothing
                was hidden or estimated to make the numbers match.
              </p>
            )}

            {breakdown.multiCurrencyWarning && (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Heads up: this payout includes more than one currency, which isn&apos;t fully supported yet.
              </p>
            )}

            {breakdown.platformRemittedTaxOrderIds.length > 0 && (
              <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                {breakdown.platformRemittedTaxOrderIds.length} order(s) in this payout had tax remitted by Shopify (marketplace
                orders) rather than you.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Row({
  label,
  value,
  currency,
  sign,
  title,
}: {
  label: string;
  value: number;
  currency: string;
  sign: "+" | "−" | "";
  title?: string;
}) {
  return (
    <div className="flex items-center justify-between" title={title}>
      <dt className="text-zinc-600 dark:text-zinc-400">{label}</dt>
      <dd>
        {sign} {money(currency, minorUnits(Math.abs(value)))}
      </dd>
    </div>
  );
}
