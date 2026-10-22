import {
  DEFAULT_FORECAST_QUANTILES,
  FORECAST_MEDIAN_LEVEL,
  forecasterResultSchema,
  type ForecasterRequest,
  type ForecasterResult,
  type TimeSeriesForecast,
  type TimeSeriesForecastRequest,
} from "@ngriffin_uk/polychat-schemas";
import { extendTimestamps } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { IEnv } from "~/types";

const FORECASTER_URL = "https://forecaster.internal/forecast";
const FORECAST_TIMEOUT_MS = 160_000;

function forecasterRequest(request: TimeSeriesForecastRequest): ForecasterRequest {
  const levels = new Set<number>([
    ...(request.quantiles ?? DEFAULT_FORECAST_QUANTILES),
    FORECAST_MEDIAN_LEVEL,
  ]);

  return {
    targets: request.series.map(({ values }) => values),
    pastCovariates: request.pastCovariates?.map(({ values }) => values) ?? [],
    knownCovariates: request.knownCovariates?.map(({ values }) => values) ?? [],
    horizon: request.horizon,
    quantiles: [...levels].sort((left, right) => left - right),
  };
}

function readForecasterError(body: string): string {
  const parsed = safeParseJson<{ error?: unknown }>(body);

  return typeof parsed?.error === "string" ? parsed.error : "The forecaster could not run";
}

function toForecast(
  request: TimeSeriesForecastRequest,
  result: ForecasterResult,
): TimeSeriesForecast {
  return {
    model: result.model,
    horizon: request.horizon,
    timestamps: request.timestamps ? extendTimestamps(request.timestamps, request.horizon) : null,
    elapsedMs: result.elapsedMs,
    series: request.series.map(({ name }, index) => ({
      name,
      quantiles: result.quantiles.map((level, quantileIndex) => ({
        level,
        values: result.values[index]?.[quantileIndex] ?? [],
      })),
    })),
  };
}

function isCompleteResult(request: TimeSeriesForecastRequest, result: ForecasterResult): boolean {
  return (
    result.values.length === request.series.length &&
    result.values.every(
      (rows) =>
        rows.length === result.quantiles.length &&
        rows.every((row) => row.length === request.horizon),
    )
  );
}

export interface ForecastEnv {
  SANDBOX_WORKER?: Pick<NonNullable<IEnv["SANDBOX_WORKER"]>, "fetch">;
}

export async function forecastTimeSeries(
  env: ForecastEnv,
  request: TimeSeriesForecastRequest,
  signal?: AbortSignal,
): Promise<TimeSeriesForecast> {
  if (!env.SANDBOX_WORKER) {
    throw new AssistantError(
      "Forecasting is not available on this deployment",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  const timeout = AbortSignal.timeout(FORECAST_TIMEOUT_MS);
  const response = await env.SANDBOX_WORKER.fetch(FORECASTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(forecasterRequest(request)),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  const body = await response.text();

  if (response.status === 400 || response.status === 422) {
    throw new AssistantError(readForecasterError(body), ErrorType.PARAMS_ERROR, 400);
  }

  const result = response.ok
    ? forecasterResultSchema.safeParse(safeParseJson<unknown>(body))
    : null;

  if (!result?.success || !isCompleteResult(request, result.data)) {
    throw new AssistantError(
      response.ok ? "The forecaster returned an unreadable result" : readForecasterError(body),
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  return toForecast(request, result.data);
}
