import Link from "next/link";

const TABS = [
  { href: "/", label: "P&L" },
  { href: "/balance-sheet", label: "Balance Sheet" },
  { href: "/cashflow", label: "Cashflow" },
  { href: "/payouts", label: "Payouts" },
  { href: "/inputs", label: "Inputs" },
] as const;

/** Every internal link carries ?shop= forward — see lib/shopify/current-store.ts for why. */
export function AppNav({ shop, current }: { shop: string; current: string }) {
  return (
    <nav className="flex items-center justify-between gap-1 border-b border-black/10 px-4 dark:border-white/10">
      <div className="flex gap-1">
        {TABS.map((tab) => {
          const isActive = tab.href === current;
          return (
            <Link
              key={tab.href}
              href={`${tab.href}?shop=${encodeURIComponent(shop)}`}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium ${
                isActive
                  ? "border-black text-black dark:border-white dark:text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      <form action="/api/shopify/refresh" method="POST">
        <input type="hidden" name="shop" value={shop} />
        <input type="hidden" name="redirectTo" value={current} />
        <button
          type="submit"
          className="shrink-0 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          title="Pull the latest orders and payments from Shopify"
        >
          ↻ Refresh
        </button>
      </form>
    </nav>
  );
}
