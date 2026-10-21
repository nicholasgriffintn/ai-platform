import type { TimeSeriesForecast, TimeSeriesForecastRequest } from "@ngriffin_uk/polychat-schemas";

import { fetchApiData } from "./fetch-wrapper.js";
import { withProjectScope } from "./project-scope.js";

const FORECAST_TIMEOUT_MS = 180_000;

export const forecastService = {
  forecast(request: TimeSeriesForecastRequest, projectId?: string): Promise<TimeSeriesForecast> {
    return fetchApiData(withProjectScope("/experiences/forecasts", projectId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: request,
      timeoutMs: FORECAST_TIMEOUT_MS,
    });
  },
};
