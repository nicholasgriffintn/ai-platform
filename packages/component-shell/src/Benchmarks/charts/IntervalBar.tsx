import { clampPercentage } from "@ngriffin_uk/polychat-utility-core";

export function IntervalBar({
  mean,
  low,
  high,
  muted = false,
}: {
  mean: number;
  low: number;
  high: number;
  muted?: boolean;
}) {
  const toPercent = (value: number) => `${clampPercentage(value * 100)}%`;

  return (
    <div className="relative h-2 w-full min-w-24 rounded-full bg-selection" aria-hidden>
      <div
        className={
          muted
            ? "absolute inset-y-0 left-0 rounded-full bg-muted-foreground/40"
            : "absolute inset-y-0 left-0 rounded-full bg-accent-amber"
        }
        style={{ width: toPercent(mean) }}
      />
      <div
        className="absolute top-1/2 h-3.5 -translate-y-1/2 border-x border-foreground/50"
        style={{ left: toPercent(low), width: `calc(${toPercent(high)} - ${toPercent(low)})` }}
      />
    </div>
  );
}
