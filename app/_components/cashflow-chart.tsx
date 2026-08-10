import { formatDecimal } from "@/lib/money";
import type { CashflowWeek } from "@/lib/dashboard/cashflow";

const BAR_WIDTH = 16;
const BAR_GAP = 4;
const COLUMN_GAP = 10;
const MAX_BAR_HEIGHT = 70;
const BASELINE_PAD = 10;

function weekLabel(weekStart: string): string {
  const date = new Date(`${weekStart}T00:00:00.000Z`);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * Diverging bar chart: cash in rises above the baseline, cash out drops
 * below it, one column per week. Plain SVG, no charting dependency —
 * CLAUDE.md's "no new dependencies without a stated reason" and this
 * dashboard's only chart need so far. Each column carries a native <title>
 * (standard browser hover tooltip, no JS) since the bars alone only show
 * relative shape, not exact amounts.
 */
export function CashflowChart({ weeks, currency }: { weeks: CashflowWeek[]; currency: string }) {
  const maxAmount = Math.max(1, ...weeks.map((week) => Math.max(week.cashIn, week.cashOut)));
  const columnWidth = BAR_WIDTH * 2 + BAR_GAP + COLUMN_GAP;
  const width = weeks.length * columnWidth;
  const height = MAX_BAR_HEIGHT * 2 + BASELINE_PAD * 2;
  const baselineY = MAX_BAR_HEIGHT + BASELINE_PAD;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Cash in and cash out by week, most recent week on the right"
      className="min-w-full"
    >
      <line x1={0} y1={baselineY} x2={width} y2={baselineY} className="stroke-black/15 dark:stroke-white/15" />
      {weeks.map((week, index) => {
        const x = index * columnWidth + COLUMN_GAP / 2;
        const inHeight = (week.cashIn / maxAmount) * MAX_BAR_HEIGHT;
        const outHeight = (week.cashOut / maxAmount) * MAX_BAR_HEIGHT;
        return (
          <g key={week.weekStart} className="cursor-default">
            <title>
              {`Week of ${weekLabel(week.weekStart)} — In: ${currency} ${formatDecimal(week.cashIn)} · Out: ${currency} ${formatDecimal(week.cashOut)}`}
            </title>
            <rect x={x} y={baselineY - inHeight} width={BAR_WIDTH} height={Math.max(inHeight, 1)} className="fill-emerald-500" opacity={0.75} />
            <rect
              x={x + BAR_WIDTH + BAR_GAP}
              y={baselineY}
              width={BAR_WIDTH}
              height={Math.max(outHeight, 1)}
              className="fill-rose-500"
              opacity={0.75}
            />
          </g>
        );
      })}
    </svg>
  );
}
