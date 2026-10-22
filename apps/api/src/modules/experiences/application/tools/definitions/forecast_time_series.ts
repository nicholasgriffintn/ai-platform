import {
  FORECAST_MAX_COVARIATES,
  FORECAST_MAX_HORIZON,
  FORECAST_MAX_TARGETS,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { FunctionToolDescriptor } from "~/types/functions";

export const FORECAST_TIME_SERIES_TOOL_NAME = "forecast_time_series";

const namedSeriesSchema = z.object({
  name: z.string().trim().min(1).max(80).describe("What the numbers measure, e.g. daily visits."),
  values: z
    .array(z.number().nullable())
    .describe("Evenly spaced observations, oldest first. Use null for a missing step."),
});

export const forecastTimeSeriesInputSchema = z.object({
  series: z
    .array(namedSeriesSchema)
    .min(1)
    .max(FORECAST_MAX_TARGETS)
    .describe(
      "The series to forecast. Several series that share the same time steps are forecast jointly, so related metrics can inform each other.",
    ),
  horizon: z
    .number()
    .int()
    .min(1)
    .max(FORECAST_MAX_HORIZON)
    .describe("How many steps ahead to forecast, in the series' own step size."),
  timestamps: z
    .array(z.string())
    .optional()
    .describe(
      "ISO dates or times for each observation, if known. Future timestamps are worked out from them.",
    ),
  known_covariates: z
    .array(namedSeriesSchema)
    .max(FORECAST_MAX_COVARIATES)
    .optional()
    .describe(
      "Drivers known ahead of time, such as holidays, planned promotions or scheduled prices. Each must cover the history and the horizon.",
    ),
  past_covariates: z
    .array(namedSeriesSchema)
    .max(FORECAST_MAX_COVARIATES)
    .optional()
    .describe("Related measurements known only for the history, such as observed temperature."),
  quantiles: z
    .array(z.number())
    .optional()
    .describe(
      "Probability levels to return, from 0.01, 0.05, 0.1 … 0.9, 0.95, 0.99. Defaults to 0.1, 0.25, 0.5, 0.75 and 0.9.",
    ),
});

export type ForecastTimeSeriesInput = z.infer<typeof forecastTimeSeriesInputSchema>;

export const forecast_time_series: FunctionToolDescriptor = {
  name: FORECAST_TIME_SERIES_TOOL_NAME,
  description:
    "Forecast numeric time series with Timestral, Mistral's time-series model, and get probabilistic ranges rather than a single guess. Use it whenever someone wants to project a metric forward: traffic, sales, sign-ups, usage, energy, sensor readings or spend. Pass the history as numbers, not prose. Read the data first with other tools or run_code if it lives elsewhere. Do not forecast numbers in your head when this tool is available.",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  maxIdenticalCalls: 2,
  inputSchema: forecastTimeSeriesInputSchema,
};
