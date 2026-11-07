import { cn } from "@ngriffin_uk/polychat-component-ui";
import { type PointerEvent, useState } from "react";

export interface TrendSeries {
  label: string;
  points: { month: number; value: number }[];
}

const WIDTH = 320;
const HEIGHT = 96;
const PAD_LEFT = 38;
const PAD_RIGHT = 6;
const PAD_TOP = 6;
const PAD_BOTTOM = 16;
const SERIES_CLASSES = ["text-[#2a78d6] dark:text-[#3987e5]", "text-[#eb6834] dark:text-[#d95926]"];

function yearLabel(month: number): string {
  return `Y${Math.floor(month / 12) + 1}`;
}

export function TrendChart({
  title,
  series,
  format,
  zeroBased = false,
  playhead,
}: {
  title: string;
  series: TrendSeries[];
  format: (value: number) => string;
  zeroBased?: boolean;
  playhead?: number;
}) {
  const [hoverMonth, setHoverMonth] = useState<number | null>(null);
  const all = series.flatMap((line) => line.points);

  if (all.length < 2) {
    return (
      <figure className="space-y-1">
        <figcaption className="text-xs font-medium">{title}</figcaption>
        <p className="py-6 text-center text-xs text-muted-foreground">Gathering a few months…</p>
      </figure>
    );
  }

  const months = all.map((point) => point.month);
  const values = all.map((point) => point.value);
  const firstMonth = Math.min(...months);
  const lastMonth = Math.max(...months);
  const rawLow = zeroBased ? 0 : Math.min(...values);
  const rawHigh = Math.max(...values);
  const margin = rawHigh === rawLow ? Math.max(Math.abs(rawHigh) * 0.1, 1) : 0;
  const low = rawLow - margin;
  const high = rawHigh + margin;
  const x = (month: number) =>
    PAD_LEFT +
    ((month - firstMonth) / Math.max(lastMonth - firstMonth, 1)) * (WIDTH - PAD_LEFT - PAD_RIGHT);
  const y = (value: number) =>
    PAD_TOP + (1 - (value - low) / (high - low)) * (HEIGHT - PAD_TOP - PAD_BOTTOM);

  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
    const fraction = (position - PAD_LEFT) / (WIDTH - PAD_LEFT - PAD_RIGHT);

    setHoverMonth(
      Math.min(lastMonth, Math.max(firstMonth, firstMonth + fraction * (lastMonth - firstMonth))),
    );
  };

  const readings =
    hoverMonth === null
      ? null
      : series.map((line) => {
          const nearest = line.points.reduce((best, point) =>
            Math.abs(point.month - hoverMonth) < Math.abs(best.month - hoverMonth) ? point : best,
          );

          return { label: line.label, point: nearest };
        });
  const latest = series.map((line) => line.points[line.points.length - 1]);

  return (
    <figure className="space-y-1">
      <figcaption className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium">{title}</span>
        <span className="font-mono text-muted-foreground tabular-nums">
          {readings
            ? `${yearLabel(readings[0].point.month)} · ${readings
                .map((reading) => format(reading.point.value))
                .join(" / ")}`
            : latest.map((point) => (point ? format(point.value) : "")).join(" / ")}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${title}, latest ${latest.map((point) => (point ? format(point.value) : "")).join(" and ")}`}
        className="w-full"
        onPointerMove={onMove}
        onPointerLeave={() => setHoverMonth(null)}
      >
        <line
          x1={PAD_LEFT}
          x2={WIDTH - PAD_RIGHT}
          y1={y(low)}
          y2={y(low)}
          className="stroke-border"
          strokeWidth={1}
        />
        <line
          x1={PAD_LEFT}
          x2={WIDTH - PAD_RIGHT}
          y1={y(high)}
          y2={y(high)}
          className="stroke-border/50"
          strokeWidth={1}
        />
        <text
          x={PAD_LEFT - 4}
          y={y(high) + 3}
          textAnchor="end"
          className="fill-muted-foreground text-[9px]"
        >
          {format(high)}
        </text>
        <text
          x={PAD_LEFT - 4}
          y={y(low)}
          textAnchor="end"
          className="fill-muted-foreground text-[9px]"
        >
          {format(low)}
        </text>
        <text x={PAD_LEFT} y={HEIGHT - 3} className="fill-muted-foreground text-[9px]">
          {yearLabel(firstMonth)}
        </text>
        <text
          x={WIDTH - PAD_RIGHT}
          y={HEIGHT - 3}
          textAnchor="end"
          className="fill-muted-foreground text-[9px]"
        >
          {yearLabel(lastMonth)}
        </text>
        {series.map((line, index) => (
          <polyline
            key={line.label}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className={cn(SERIES_CLASSES[index])}
            points={line.points.map((point) => `${x(point.month)},${y(point.value)}`).join(" ")}
          />
        ))}
        {playhead !== undefined && (
          <line
            x1={x(Math.min(lastMonth, Math.max(firstMonth, playhead)))}
            x2={x(Math.min(lastMonth, Math.max(firstMonth, playhead)))}
            y1={PAD_TOP}
            y2={HEIGHT - PAD_BOTTOM}
            className="stroke-foreground"
            strokeWidth={1.5}
          />
        )}
        {hoverMonth !== null && (
          <line
            x1={x(hoverMonth)}
            x2={x(hoverMonth)}
            y1={PAD_TOP}
            y2={HEIGHT - PAD_BOTTOM}
            className="stroke-muted-foreground"
            strokeWidth={1}
          />
        )}
      </svg>
    </figure>
  );
}

export function SeriesLegend({ labels }: { labels: string[] }) {
  if (labels.length < 2) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {labels.map((label, index) => (
        <span key={label} className="flex items-center gap-1.5">
          <span aria-hidden className={cn("h-0.5 w-4 bg-current", SERIES_CLASSES[index])} />
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}
