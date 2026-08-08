import { daysLeftInTrial, isReadOnly } from "@/lib/billing/access";

export function TrialBanner({
  shop,
  trialEndsAt,
  subscriptionStatus,
}: {
  shop: string;
  trialEndsAt: Date | null;
  subscriptionStatus: string;
}) {
  const status = { trialEndsAt, subscriptionStatus };
  const readOnly = isReadOnly(status);
  const daysLeft = daysLeftInTrial(status);

  if (subscriptionStatus === "active" || daysLeft === null) return null;

  if (readOnly) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/50 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-300">
        <span>Your trial has ended — you can still view everything, but Settings changes are paused.</span>
        <a
          href={`/api/stripe/checkout?shop=${encodeURIComponent(shop)}`}
          className="rounded-full bg-amber-900 px-3 py-1 font-medium text-amber-50 dark:bg-amber-300 dark:text-amber-950"
        >
          Subscribe
        </a>
      </div>
    );
  }

  if (daysLeft <= 3) {
    return (
      <div className="border-b border-black/10 bg-zinc-50 px-4 py-2 text-sm text-zinc-600 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-400">
        {daysLeft === 0 ? "Trial ends today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your trial`} —{" "}
        <a href={`/api/stripe/checkout?shop=${encodeURIComponent(shop)}`} className="underline">
          subscribe
        </a>{" "}
        to keep going without interruption.
      </div>
    );
  }

  return null;
}
