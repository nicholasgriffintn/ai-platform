import { findForecastQuantile } from "@ngriffin_uk/polychat-library-chat/forecast";
import {
  FORECAST_MEDIAN_LEVEL,
  type ForecastSeries,
  type TimeSeriesForecast,
} from "@ngriffin_uk/polychat-schemas";
import { roundToSignificant } from "@ngriffin_uk/polychat-utility-core";

const LISTED_STEPS = 24;
const SIGNIFICANT_DIGITS = 4;

function listedSteps(horizon: number): number[] {
  if (horizon <= LISTED_STEPS) {
    return Array.from({ length: horizon }, (_, index) => index);
  }

  return Array.from({ length: LISTED_STEPS }, (_, index) =>
    Math.round((index * (horizon - 1)) / (LISTED_STEPS - 1)),
  );
}

function round(value: number | undefined): string {
  return value === undefined ? "?" : String(roundToSignificant(value, SIGNIFICANT_DIGITS));
}

function describeSeries(series: ForecastSeries, forecast: TimeSeriesForecast): string[] {
  const median = findForecastQuantile(series, FORECAST_MEDIAN_LEVEL) ?? [];
  const levels = series.quantiles.map(({ level }) => level);
  const lowLevel = Math.min(...levels);
  const highLevel = Math.max(...levels);
  const low = findForecastQuantile(series, lowLevel) ?? [];
  const high = findForecastQuantile(series, highLevel) ?? [];
  const band = `${Math.round(lowLevel * 100)}th–${Math.round(highLevel * 100)}th percentile`;
  const rows = listedSteps(forecast.horizon).map((step) => {
    const when = forecast.timestamps?.[step] ?? `+${step + 1}`;

    return `${when} | ${round(median[step])} | ${round(low[step])} – ${round(high[step])}`;
  });

  return [
    `${series.name}: median ${round(median[0])} → ${round(median.at(-1))}, ${band} at the last step ${round(low.at(-1))} – ${round(high.at(-1))}.`,
    `step | median | ${band}`,
    ...rows,
  ];
}

export function describeForecast(forecast: TimeSeriesForecast): string {
  const span = forecast.timestamps
    ? ` (${forecast.timestamps[0]} to ${forecast.timestamps.at(-1)})`
    : "";

  return [
    `Timestral forecast, ${forecast.horizon} steps ahead${span}. Ranges are probabilistic: quote them, not just the median.`,
    ...forecast.series.flatMap((series) => ["", ...describeSeries(series, forecast)]),
  ].join("\n");
}
