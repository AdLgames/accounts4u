export function Stat({ label, value, detail, accent }: { label: string; value: string; detail?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white px-5 py-4 dark:border-white/10 dark:bg-zinc-950">
      <p className="text-[12.5px] font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p
        className={`mt-2 font-mono text-[28px] font-semibold tracking-tight ${accent ? "text-teal-600 dark:text-teal-400" : ""}`}
      >
        {value}
      </p>
      {detail && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{detail}</p>}
    </div>
  );
}
