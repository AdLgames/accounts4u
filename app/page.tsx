import { formatDecimal } from "@/lib/money";
import { buildMonthlyOverview } from "@/lib/dashboard/overview";
import { resolveCurrentStore } from "@/lib/shopify/current-store";
import { AppNav } from "./_components/app-nav";
import { NotConnected } from "./_components/not-connected";
import { firstParam } from "./_lib/search-params";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthLabel(month: string): string {
  const [year, monthIndex] = month.split("-").map(Number);
  return `${MONTH_NAMES[monthIndex - 1]} ${year}`;
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const shop = firstParam(params.shop);
  const idToken = firstParam(params.id_token);

  const store = await resolveCurrentStore(shop, idToken);
  if (!store || !shop) {
    return <NotConnected />;
  }

  const overview = await buildMonthlyOverview(store.id);
  const currency = overview.currency ?? "";

  return (
    <div className="flex min-h-full flex-col">
      <AppNav shop={shop} current="/" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{monthLabel(overview.month)}</p>

        {overview.payoutCount === 0 ? (
          <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
            No payouts yet this month — check back once Shopify deposits money to your bank account.
          </p>
        ) : (
          <div className="mt-6 flex flex-col gap-6">
            <Stat
              label="True profit this month"
              value={`${currency} ${formatDecimal(overview.trueProfit)}`}
              detail="Net sales after Shopify's fees and refunds, minus product costs, ad spend, and recurring expenses."
            />
            <Stat
              label="Set aside for tax"
              value={`${currency} ${formatDecimal(overview.taxSetAside)}`}
              detail="An estimate based on the percentage set in Settings — not tax advice."
            />
            {overview.lastPayout && (
              <Stat
                label="Last payout"
                value={`${overview.lastPayout.currency} ${formatDecimal(overview.lastPayout.amount)}`}
                detail={overview.lastPayout.date.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              />
            )}
          </div>
        )}

        {overview.unexplainedPayoutCount > 0 && (
          <p className="mt-6 rounded border border-amber-400/50 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            {overview.unexplainedPayoutCount} payout(s) this month don&apos;t fully add up yet — check the Payouts screen for
            details.
          </p>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{detail}</p>
    </div>
  );
}
