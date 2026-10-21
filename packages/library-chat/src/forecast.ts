import type {
  ForecastNamedValues,
  ForecastSeries,
  TimeSeriesForecast,
  TimeSeriesForecastRequest,
  TimeSeriesForecastView,
} from "@ngriffin_uk/polychat-schemas";
import {
  clampNumber,
  lastIndexWhere,
  parseCsvText,
  parseNumericCell,
} from "@ngriffin_uk/polychat-utility-core";

const MIN_HISTORY_POINTS = 120;
const MAX_HISTORY_POINTS = 512;
const NUMERIC_SHARE = 0.9;
const TIMESTAMP_SHAPE = /[-/:T]/;

export type ForecastColumnKind = "time" | "numeric" | "text";

export interface ForecastColumn {
  name: string;
  kind: ForecastColumnKind;
  raw: string[];
  values: (number | null)[];
}

export interface ForecastTable {
  columns: ForecastColumn[];
  rowCount: number;
}

export interface ForecastSelection {
  targets: readonly string[];
  knownCovariates?: readonly string[];
  pastCovariates?: readonly string[];
  timeColumn?: string | null;
  horizon: number;
}

export type ForecastRequestResult =
  | { ok: true; request: TimeSeriesForecastRequest }
  | { ok: false; error: string };

export function findForecastQuantile(series: ForecastSeries, level: number): number[] | null {
  return series.quantiles.find((quantile) => quantile.level === level)?.values ?? null;
}

export function forecastHistoryPoints(horizon: number): number {
  return clampNumber(horizon * 3, MIN_HISTORY_POINTS, MAX_HISTORY_POINTS);
}

export function buildForecastView(
  request: Pick<TimeSeriesForecastRequest, "series" | "timestamps">,
  forecast: TimeSeriesForecast,
): TimeSeriesForecastView {
  const keep = forecastHistoryPoints(forecast.horizon);

  return {
    ...forecast,
    history: {
      timestamps: request.timestamps?.slice(-keep) ?? null,
      series: request.series.map(({ name, values }) => ({ name, values: values.slice(-keep) })),
    },
  };
}

function columnKind(
  raw: readonly string[],
  values: readonly (number | null)[],
): ForecastColumnKind {
  const filled = raw.filter((value) => value !== "");
  const numeric = values.filter((value) => value !== null).length;

  if (filled.length === 0) {
    return "text";
  }

  if (
    numeric < filled.length &&
    filled.every((value) => TIMESTAMP_SHAPE.test(value) && Number.isFinite(Date.parse(value)))
  ) {
    return "time";
  }

  return numeric >= 2 && numeric >= filled.length * NUMERIC_SHARE ? "numeric" : "text";
}

export function readForecastTable(text: string): ForecastTable {
  const { header, rows } = parseCsvText(text);
  const columns = header.map((name, index) => {
    const raw = rows.map((row) => (row[index] ?? "").trim());
    const values = raw.map(parseNumericCell);

    return { name: name || `Column ${index + 1}`, kind: columnKind(raw, values), raw, values };
  });

  return { columns, rowCount: rows.length };
}

function pickColumns(table: ForecastTable, names: readonly string[] = []): ForecastColumn[] {
  return names.flatMap((name) => table.columns.filter((column) => column.name === name));
}

function lastObservedRow(columns: readonly ForecastColumn[]): number {
  return columns.reduce(
    (last, column) =>
      Math.max(
        last,
        lastIndexWhere(column.values, (value) => value !== null),
      ),
    -1,
  );
}

function namedValues(columns: readonly ForecastColumn[], length: number): ForecastNamedValues[] {
  return columns.map(({ name, values }) => ({ name, values: values.slice(0, length) }));
}

export function buildForecastRequest(
  table: ForecastTable,
  selection: ForecastSelection,
): ForecastRequestResult {
  const targets = pickColumns(table, selection.targets);

  if (targets.length === 0) {
    return { ok: false, error: "Pick at least one column to forecast" };
  }

  const length = lastObservedRow(targets) + 1;
  const known = pickColumns(table, selection.knownCovariates);
  const past = pickColumns(table, selection.pastCovariates);
  const futureRows = table.rowCount - length;

  if (known.length > 0 && futureRows < selection.horizon) {
    return {
      ok: false,
      error: `Known-ahead columns need ${selection.horizon} rows past the last value, and the table has ${Math.max(0, futureRows)}`,
    };
  }

  const timeColumn = selection.timeColumn
    ? table.columns.find((column) => column.name === selection.timeColumn)
    : undefined;

  return {
    ok: true,
    request: {
      series: namedValues(targets, length),
      horizon: selection.horizon,
      ...(timeColumn ? { timestamps: timeColumn.raw.slice(0, length) } : {}),
      ...(past.length > 0 ? { pastCovariates: namedValues(past, length) } : {}),
      ...(known.length > 0
        ? { knownCovariates: namedValues(known, length + selection.horizon) }
        : {}),
    },
  };
}
