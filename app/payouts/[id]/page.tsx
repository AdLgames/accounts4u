import Link from "next/link";
import { formatDecimal, minorUnits } from "@/lib/money";
import type { MinorUnits } from "@/lib/money";
import { resolveCurrentStore } from "@/lib/shopify/current-store";
import { explainPayoutById } from "@/lib/dashboard/payouts";
import { AppShell } from "../../_components/app-shell";
import { Card } from "../../_components/card";
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
    <AppShell
      shop={shop}
      current="/payouts"
      title={breakdown ? `${money(breakdown.currency, breakdown.deposited)} arrived` : "Payout"}
      subtitle={breakdown ? undefined : "Payout not found"}
      lastSyncAt={store.lastSyncAt}
      banner={<TrialBanner shop={shop} trialEndsAt={store.trialEndsAt} subscriptionStatus={store.subscriptionStatus} />}
    >
      <div className="mx-auto w-full max-w-4xl">
        <Link href={`/payouts?shop=${encodeURIComponent(shop)}`} className="text-sm text-zinc-500 hover:underline">
          ← Payouts
        </Link>

        {!breakdown ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Payout not found.</p>
        ) : (
          <Card className="mt-4 px-5 py-4">
            <dl className="flex flex-col text-sm">
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
          </Card>
        )}

        {breakdown && !breakdown.isExplained && (
          <p className="mt-4 rounded-2xl border border-amber-400/50 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            This payout doesn&apos;t fully add up yet — {money(breakdown.currency, breakdown.residual)} unexplained. Nothing
            was hidden or estimated to make the numbers match.
          </p>
        )}

        {breakdown?.multiCurrencyWarning && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Heads up: this payout includes more than one currency, which isn&apos;t fully supported yet.
          </p>
        )}

        {breakdown && breakdown.platformRemittedTaxOrderIds.length > 0 && (
          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            {breakdown.platformRemittedTaxOrderIds.length} order(s) in this payout had tax remitted by Shopify (marketplace
            orders) rather than you.
          </p>
        )}
      </div>
    </AppShell>
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
    <div className="flex items-center justify-between py-0.5" title={title}>
      <dt className="text-zinc-600 dark:text-zinc-400">{label}</dt>
      <dd className="font-mono">
        {sign} {money(currency, minorUnits(Math.abs(value)))}
      </dd>
    </div>
  );
}
