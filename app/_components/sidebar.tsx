import Link from "next/link";
import { formatRelativeTime } from "../_lib/relative-time";

const TABS = [
  { href: "/", label: "P&L" },
  { href: "/balance-sheet", label: "Balance Sheet" },
  { href: "/cashflow", label: "Cashflow" },
  { href: "/payouts", label: "Payouts" },
  { href: "/inputs", label: "Inputs" },
] as const;

/** Every internal link carries ?shop= forward — see lib/shopify/current-store.ts for why. */
export function Sidebar({ shop, current, lastSyncAt }: { shop: string; current: string; lastSyncAt: Date | null }) {
  const shopLabel = shop.replace(/\.myshopify\.com$/, "");

  return (
    <aside className="flex shrink-0 flex-col gap-4 border-b border-black/10 bg-zinc-50 px-3 py-4 md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0 dark:border-white/10 dark:bg-zinc-950">
      <div className="flex items-center gap-2.5 px-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 font-mono text-xs font-semibold text-white">
          a4
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold">PayoutClear</span>
          <span className="truncate text-[11px] text-zinc-400 dark:text-zinc-500">{shopLabel}</span>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 md:flex-1">
        {TABS.map((tab) => {
          const isActive = tab.href === current;
          return (
            <Link
              key={tab.href}
              href={`${tab.href}?shop=${encodeURIComponent(shop)}`}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium ${
                isActive
                  ? "bg-teal-600/10 text-zinc-900 dark:bg-teal-400/10 dark:text-white"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isActive ? "bg-teal-500" : "bg-transparent"}`} />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 rounded-lg border border-black/10 px-2.5 py-2 text-[11.5px] text-zinc-500 dark:border-white/10 dark:text-zinc-400">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
        Synced {formatRelativeTime(lastSyncAt)}
      </div>
    </aside>
  );
}
