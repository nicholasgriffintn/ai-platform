import type { TimeSeriesForecastView } from "@ngriffin_uk/polychat-schemas";
import { formatCompactNumber } from "@ngriffin_uk/polychat-utility-core";
import { type PointerEvent, useState } from "react";

import {
  buildForecastChartGeometry,
  type ForecastChartFrame,
  forecastBandLabel,
  readForecastStep,
} from "./forecast-chart";

const FRAME: ForecastChartFrame = {
  width: 640,
  height: 220,
  padding: { top: 12, right: 12, bottom: 22, left: 48 },
};
const BAND_OPACITY = [0.12, 0.2, 0.3, 0.4];

interface ForecastChartProps {
  view: TimeSeriesForecastView;
  seriesIndex: number;
}

function formatReadoutValue(value: number | null): string {
  return value === null ? "—" : formatCompactNumber(value);
}

export function ForecastChart({ view, seriesIndex }: ForecastChartProps) {
  const [hoverStep, setHoverStep] = useState<number | null>(null);
  const geometry = buildForecastChartGeometry(view, seriesIndex, FRAME);
  const name = view.series[seriesIndex]?.name ?? "Series";

  if (!geometry) {
    return null;
  }

  const readout = readForecastStep(view, seriesIndex, hoverStep ?? geometry.stepCount - 1);
  const firstLabel = view.history.timestamps?.[0];
  const lastLabel = view.timestamps?.at(-1) ?? `+${view.horizon}`;

  const trackPointer = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();

    setHoverStep(geometry.stepForX(((event.clientX - box.left) / box.width) * FRAME.width));
  };

  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">{name}</span>
        {readout && (
          <span className="font-mono text-muted-foreground tabular-nums">
            {readout.label} ·{" "}
            {readout.isForecast
              ? `${formatReadoutValue(readout.median)} (${formatReadoutValue(readout.lower)} – ${formatReadoutValue(readout.upper)})`
              : `observed ${formatReadoutValue(readout.observed)}`}
          </span>
        )}
      </figcaption>
      <svg
        viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
        className="w-full touch-none overflow-visible select-none"
        onPointerMove={trackPointer}
        onPointerLeave={() => setHoverStep(null)}
      >
        <title>{`Forecast for ${name}, ${view.horizon} steps ahead`}</title>
        {geometry.yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={geometry.plotLeft}
              x2={geometry.plotRight}
              y1={tick.y}
              y2={tick.y}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={geometry.plotLeft - 8}
              y={tick.y}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground font-mono text-[10px]"
            >
              {formatCompactNumber(tick.value)}
            </text>
          </g>
        ))}
        <rect
          x={geometry.nowX}
          y={geometry.plotTop}
          width={geometry.plotRight - geometry.nowX}
          height={geometry.plotBottom - geometry.plotTop}
          className="fill-accent-sky/5"
        />
        {geometry.bands.map((band, index) => (
          <path
            key={`${band.lower}-${band.upper}`}
            d={band.path}
            className="fill-accent-sky transition-opacity duration-700"
            opacity={BAND_OPACITY[Math.min(index, BAND_OPACITY.length - 1)]}
          />
        ))}
        <path
          d={geometry.historyPath}
          fill="none"
          className="stroke-foreground/70"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <path
          d={geometry.medianPath}
          fill="none"
          className="stroke-accent-sky"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <line
          x1={geometry.nowX}
          x2={geometry.nowX}
          y1={geometry.plotTop}
          y2={geometry.plotBottom}
          className="stroke-border-strong"
          strokeDasharray="3 3"
        />
        {hoverStep !== null && (
          <line
            x1={geometry.xForStep(hoverStep)}
            x2={geometry.xForStep(hoverStep)}
            y1={geometry.plotTop}
            y2={geometry.plotBottom}
            className="stroke-foreground/40"
          />
        )}
        <text
          x={geometry.plotLeft}
          y={FRAME.height - 4}
          className="fill-muted-foreground font-mono text-[10px]"
        >
          {firstLabel ?? `-${view.history.series[seriesIndex]?.values.length ?? 0}`}
        </text>
        <text
          x={geometry.nowX}
          y={FRAME.height - 4}
          textAnchor="middle"
          className="fill-muted-foreground font-mono text-[10px]"
        >
          now
        </text>
        <text
          x={geometry.plotRight}
          y={FRAME.height - 4}
          textAnchor="end"
          className="fill-muted-foreground font-mono text-[10px]"
        >
          {lastLabel}
        </text>
      </svg>
      {geometry.bands.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-accent-sky" aria-hidden />
            Median
          </span>
          {geometry.bands.map((band, index) => (
            <span key={`${band.lower}-legend`} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-4 rounded-sm bg-accent-sky"
                style={{ opacity: BAND_OPACITY[Math.min(index, BAND_OPACITY.length - 1)] }}
                aria-hidden
              />
              {forecastBandLabel(band)}
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}
