import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950 ${className}`}>
      {children}
    </div>
  );
}

export function CardLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">{children}</span>
  );
}
