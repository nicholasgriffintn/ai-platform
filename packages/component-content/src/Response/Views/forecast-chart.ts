import {
  FORECAST_MEDIAN_LEVEL,
  type ForecastSeries,
  type TimeSeriesForecastView,
} from "@ngriffin_uk/polychat-schemas";
import { lastIndexWhere } from "@ngriffin_uk/polychat-utility-core";

export interface ForecastChartFrame {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

export interface ForecastBand {
  lower: number;
  upper: number;
  path: string;
}

export interface ForecastChartGeometry {
  historyPath: string;
  medianPath: string;
  bands: ForecastBand[];
  yTicks: { value: number; y: number }[];
  nowX: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  stepCount: number;
  xForStep: (step: number) => number;
  stepForX: (x: number) => number;
}

export interface ForecastReadout {
  step: number;
  label: string;
  median: number | null;
  lower: number | null;
  upper: number | null;
  observed: number | null;
  isForecast: boolean;
}

const Y_TICKS = 4;
const Y_PADDING_SHARE = 0.06;

function finite(values: readonly (number | null | undefined)[]): number[] {
  return values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
}

function bandPairs(series: ForecastSeries): [number, number][] {
  const levels = series.quantiles
    .map(({ level }) => level)
    .filter((level) => level !== FORECAST_MEDIAN_LEVEL)
    .sort((left, right) => left - right);

  return levels
    .filter((level) => level < FORECAST_MEDIAN_LEVEL)
    .map((lower): [number, number] => [lower, 1 - lower])
    .filter(([, upper]) => levels.some((level) => Math.abs(level - upper) < 1e-9));
}

function quantileValues(series: ForecastSeries, level: number): number[] {
  return series.quantiles.find((quantile) => Math.abs(quantile.level - level) < 1e-9)?.values ?? [];
}

function linePath(points: readonly ([number, number] | null)[]): string {
  let path = "";
  let drawing = false;

  for (const point of points) {
    if (!point) {
      drawing = false;
      continue;
    }

    path += `${drawing ? "L" : "M"}${point[0].toFixed(2)},${point[1].toFixed(2)}`;
    drawing = true;
  }

  return path;
}

function lastObserved(values: readonly (number | null)[]): { index: number; value: number } | null {
  const index = lastIndexWhere(values, (value) => value !== null);
  const value = values[index];

  return index >= 0 && typeof value === "number" ? { index, value } : null;
}

export function buildForecastChartGeometry(
  view: TimeSeriesForecastView,
  seriesIndex: number,
  frame: ForecastChartFrame,
): ForecastChartGeometry | null {
  const series = view.series[seriesIndex];
  const history = view.history.series[seriesIndex]?.values ?? [];

  if (!series) {
    return null;
  }

  const median = quantileValues(series, FORECAST_MEDIAN_LEVEL);
  const pairs = bandPairs(series);
  const bandValues = series.quantiles.flatMap(({ values }) => values);
  const domain = finite([...history, ...median, ...bandValues]);

  if (domain.length === 0) {
    return null;
  }

  const rawMin = Math.min(...domain);
  const rawMax = Math.max(...domain);
  const spread = rawMax - rawMin || Math.abs(rawMax) || 1;
  const yMin = rawMin - spread * Y_PADDING_SHARE;
  const yMax = rawMax + spread * Y_PADDING_SHARE;
  const plotLeft = frame.padding.left;
  const plotRight = frame.width - frame.padding.right;
  const plotTop = frame.padding.top;
  const plotBottom = frame.height - frame.padding.bottom;
  const stepCount = history.length + view.horizon;
  const xForStep = (step: number) =>
    plotLeft + (step / Math.max(1, stepCount - 1)) * (plotRight - plotLeft);
  const yForValue = (value: number) =>
    plotBottom - ((value - yMin) / (yMax - yMin)) * (plotBottom - plotTop);
  const stepForX = (x: number) =>
    Math.round(
      Math.min(
        stepCount - 1,
        Math.max(0, ((x - plotLeft) / (plotRight - plotLeft)) * (stepCount - 1)),
      ),
    );
  const anchor = lastObserved(history);
  const anchorPoint: [number, number] | null = anchor
    ? [xForStep(anchor.index), yForValue(anchor.value)]
    : null;
  const forecastX = (step: number) => xForStep(history.length + step);

  const bands = pairs.map(([lower, upper]) => {
    const low = quantileValues(series, lower);
    const high = quantileValues(series, upper);
    const top = high.map((value, step): [number, number] => [forecastX(step), yForValue(value)]);
    const bottom = low
      .map((value, step): [number, number] => [forecastX(step), yForValue(value)])
      .reverse();
    const outline = [...(anchorPoint ? [anchorPoint] : []), ...top, ...bottom];

    return { lower, upper, path: `${linePath(outline)}Z` };
  });

  return {
    historyPath: linePath(
      history.map((value, step) => (value === null ? null : [xForStep(step), yForValue(value)])),
    ),
    medianPath: linePath([
      anchorPoint,
      ...median.map((value, step): [number, number] => [forecastX(step), yForValue(value)]),
    ]),
    bands,
    yTicks: Array.from({ length: Y_TICKS }, (_, index) => {
      const value = yMin + ((yMax - yMin) * index) / (Y_TICKS - 1);

      return { value, y: yForValue(value) };
    }),
    nowX: xForStep(Math.max(0, history.length - 1)),
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    stepCount,
    xForStep,
    stepForX,
  };
}

export function readForecastStep(
  view: TimeSeriesForecastView,
  seriesIndex: number,
  step: number,
): ForecastReadout | null {
  const series = view.series[seriesIndex];
  const history = view.history.series[seriesIndex]?.values ?? [];

  if (!series) {
    return null;
  }

  if (step < history.length) {
    return {
      step,
      label:
        view.history.timestamps?.[step] ??
        (step === history.length - 1 ? "Latest" : `${step - history.length + 1}`),
      median: null,
      lower: null,
      upper: null,
      observed: history[step] ?? null,
      isForecast: false,
    };
  }

  const forecastStep = step - history.length;
  const [outer] = bandPairs(series);

  return {
    step,
    label: view.timestamps?.[forecastStep] ?? `+${forecastStep + 1}`,
    median: quantileValues(series, FORECAST_MEDIAN_LEVEL)[forecastStep] ?? null,
    lower: outer ? (quantileValues(series, outer[0])[forecastStep] ?? null) : null,
    upper: outer ? (quantileValues(series, outer[1])[forecastStep] ?? null) : null,
    observed: null,
    isForecast: true,
  };
}

export function forecastBandLabel(band: Pick<ForecastBand, "lower" | "upper">): string {
  return `${Math.round((band.upper - band.lower) * 100)}% range`;
}
