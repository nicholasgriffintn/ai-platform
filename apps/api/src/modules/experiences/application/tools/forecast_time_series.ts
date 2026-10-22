import { buildForecastView } from "@ngriffin_uk/polychat-library-chat/forecast";
import {
  timeSeriesForecastRequestSchema,
  type TimeSeriesForecastRequest,
} from "@ngriffin_uk/polychat-schemas";

import { describeForecast } from "~/modules/experiences/application/forecasts/describe";
import { forecastTimeSeries } from "~/modules/experiences/application/forecasts/forecast";
import { resolveRequestProjectId } from "~/modules/tools/application/request-context";
import { requireOptionalProjectCapabilityAccess } from "~/modules/workspaces/application/access";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

import {
  FORECAST_TIME_SERIES_TOOL_NAME,
  forecast_time_series as forecastTimeSeriesDescriptor,
  type ForecastTimeSeriesInput,
} from "./definitions/forecast_time_series";

function toRequest(args: ForecastTimeSeriesInput): unknown {
  return {
    series: args.series,
    horizon: args.horizon,
    ...(args.timestamps ? { timestamps: args.timestamps } : {}),
    ...(args.known_covariates ? { knownCovariates: args.known_covariates } : {}),
    ...(args.past_covariates ? { pastCovariates: args.past_covariates } : {}),
    ...(args.quantiles ? { quantiles: args.quantiles } : {}),
  };
}

function invalid(message: string): IFunctionResponse {
  return { status: "error", name: FORECAST_TIME_SERIES_TOOL_NAME, content: message, data: {} };
}

export const forecast_time_series: ApiToolDefinition = {
  ...forecastTimeSeriesDescriptor,
  execute: async (args: ForecastTimeSeriesInput, toolContext) => {
    const request = toolContext.request;

    if (request.context) {
      await requireOptionalProjectCapabilityAccess(
        request.context,
        resolveRequestProjectId(request) ?? undefined,
        "app",
        "featured-forecasts",
      );
    }

    const parsed = timeSeriesForecastRequestSchema.safeParse(toRequest(args));

    if (!parsed.success) {
      return invalid(
        `The forecast input does not fit: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
      );
    }

    const forecastRequest: TimeSeriesForecastRequest = parsed.data;
    const forecast = await forecastTimeSeries(request.env, forecastRequest);

    return {
      status: "success",
      name: FORECAST_TIME_SERIES_TOOL_NAME,
      content: describeForecast(forecast),
      data: buildForecastView(forecastRequest, forecast),
    };
  },
};
