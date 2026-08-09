import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";

function PageHeader({
  shop,
  current,
  title,
  subtitle,
}: {
  shop: string;
  current: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-black/10 px-6 py-5 md:px-10 dark:border-white/10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
      </div>
      <form action="/api/shopify/refresh" method="POST">
        <input type="hidden" name="shop" value={shop} />
        <input type="hidden" name="redirectTo" value={current} />
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3.5 py-2 text-[12.5px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-white/15 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-white/5"
          title="Pull the latest orders and payments from Shopify"
        >
          <span>↻</span> Refresh
        </button>
      </form>
    </header>
  );
}

/**
 * Shared shell for every dashboard page: left sidebar nav (Sidebar) + a
 * header with page title/subtitle and the refresh button, wrapping the
 * page's own content. `banner` renders full-width between the header and
 * content (RefreshStatus/TrialBanner); `footer` renders below content,
 * still inside the right-hand column (LegalFooter).
 */
export function AppShell({
  shop,
  current,
  title,
  subtitle,
  lastSyncAt,
  banner,
  footer,
  children,
}: {
  shop: string;
  current: string;
  title: string;
  subtitle?: string;
  lastSyncAt: Date | null;
  banner?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <Sidebar shop={shop} current={current} lastSyncAt={lastSyncAt} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader shop={shop} current={current} title={title} subtitle={subtitle} />
        {banner}
        <main className="flex-1 px-6 py-8 md:px-10">{children}</main>
        {footer}
      </div>
    </div>
  );
}
