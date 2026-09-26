import type { TrainingMetricPoint } from "@ngriffin_uk/polychat-schemas";
import { useId } from "react";

const WIDTH = 600;
const HEIGHT = 160;

type Series = { key: "trainLoss" | "validLoss" | "reward"; label: string; className: string };

const SERIES: Series[] = [
  { key: "trainLoss", label: "Train loss", className: "text-active-work" },
  { key: "validLoss", label: "Validation loss", className: "text-attention" },
  { key: "reward", label: "Reward", className: "text-success" },
];

function pathFor(
  points: readonly TrainingMetricPoint[],
  key: Series["key"],
  scale: (step: number, value: number) => string,
) {
  return points
    .flatMap((point) => {
      const value = point[key];

      return value === null ? [] : [scale(point.step, value)];
    })
    .map((xy, index) => `${index === 0 ? "M" : "L"}${xy}`)
    .join(" ");
}

export function LossChart({ metrics }: { metrics: readonly TrainingMetricPoint[] }) {
  const titleId = useId();
  const present = SERIES.filter((series) => metrics.some((point) => point[series.key] !== null));

  if (metrics.length < 2 || present.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Metrics appear once the trainer reports its first steps.
      </p>
    );
  }

  const values = metrics.flatMap((point) => present.flatMap((series) => point[series.key] ?? []));
  const steps = metrics.map((point) => point.step);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const minStep = Math.min(...steps);
  const maxStep = Math.max(...steps);
  const scale = (step: number, value: number) =>
    `${((step - minStep) / Math.max(maxStep - minStep, 1)) * WIDTH} ${
      HEIGHT - ((value - minValue) / Math.max(maxValue - minValue, 1e-6)) * HEIGHT
    }`;

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-40 w-full"
        aria-labelledby={titleId}
      >
        <title id={titleId}>{`Training metrics over ${metrics.length} steps`}</title>
        {present.map((series) => (
          <path
            key={series.key}
            d={pathFor(metrics, series.key, scale)}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            className={series.className}
          />
        ))}
      </svg>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {present.map((series) => (
          <span key={series.key} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-0.5 w-4 bg-current ${series.className}`} />
            {series.label}
          </span>
        ))}
        <span>
          steps {minStep}–{maxStep}
        </span>
      </div>
    </div>
  );
}
