import type { BenchmarkItemDetail } from "@ngriffin_uk/polychat-schemas";
import {
  clampPercentage,
  getBooleanProperty,
  getNumberProperty,
  getStringProperty,
} from "@ngriffin_uk/polychat-utility-core";

const DECADES_EACH_SIDE = 2;

function position(value: number, truth: number): string {
  const offset = Math.log10(value / truth);

  return `${clampPercentage(((offset + DECADES_EACH_SIDE) / (2 * DECADES_EACH_SIDE)) * 100)}%`;
}

function formatQuantity(value: number): string {
  return Math.abs(value) >= 1e7 || (Math.abs(value) < 0.01 && value !== 0)
    ? value.toExponential(2)
    : value.toLocaleString("en-GB", { maximumSignificantDigits: 4 });
}

function IntervalStrip({ detail }: { detail: BenchmarkItemDetail }) {
  const truth = getNumberProperty(detail.reveal, "answer");
  const low = getNumberProperty(detail.result?.answer, "low");
  const high = getNumberProperty(detail.result?.answer, "high");
  const estimate = getNumberProperty(detail.result?.answer, "estimate");

  if (truth === undefined || low === undefined || high === undefined || estimate === undefined) {
    return <p className="text-xs text-failure">No usable estimate</p>;
  }

  const hit = getBooleanProperty(detail.result?.detail, "hit");

  return (
    <div
      className="relative h-5 w-full rounded bg-selection"
      aria-label={`Interval ${formatQuantity(low)} to ${formatQuantity(high)}, answer ${formatQuantity(truth)}`}
    >
      <div
        className={
          hit
            ? "absolute inset-y-1 rounded bg-success/40"
            : "absolute inset-y-1 rounded bg-failure/35"
        }
        style={{
          left: position(low, truth),
          width: `calc(${position(high, truth)} - ${position(low, truth)})`,
        }}
      />
      <div
        className="absolute inset-y-0 w-0.5 bg-foreground"
        style={{ left: position(estimate, truth) }}
      />
      <div className="absolute inset-y-[-3px] left-1/2 w-px border-l border-dashed border-accent-amber" />
    </div>
  );
}

export function FermiItems({ items }: { items: readonly BenchmarkItemDetail[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        The dashed line is the true answer, the bar is the 90% interval and the tick is the
        estimate. The strip spans a hundred times either side, on a log scale.
      </p>
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {items.map((detail) => (
          <li
            key={detail.item.id}
            className="grid gap-2 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] md:items-center"
          >
            <div className="min-w-0 space-y-0.5 text-sm">
              <p className="text-foreground">{getStringProperty(detail.item.data, "question")}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                Answer {formatQuantity(getNumberProperty(detail.reveal, "answer") ?? 0)}{" "}
                {getStringProperty(detail.reveal, "unit")} · scored{" "}
                {Math.round((detail.result?.score ?? 0) * 100)}
              </p>
            </div>
            <IntervalStrip detail={detail} />
          </li>
        ))}
      </ul>
    </div>
  );
}
