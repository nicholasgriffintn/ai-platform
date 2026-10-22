import {
  errorResponseSchema,
  timeSeriesForecastRequestSchema,
  timeSeriesForecastSchema,
} from "@ngriffin_uk/polychat-schemas";

import { defineResource } from "~/infrastructure/http/resource";
import type { HonoLike } from "~/infrastructure/http/routeBuilder";
import { forecastTimeSeries } from "~/modules/experiences/application/forecasts/forecast";
import { projectScopeQuerySchema } from "~/modules/workspaces/application/access";

import { requireExperience } from "./access";

export function defineForecasts(app: HonoLike): void {
  defineResource(
    app,
    { path: "/forecasts", idParam: "forecast_id", tags: ["experiences"] },
    (forecasts) => {
      forecasts.create({
        auth: true,
        summary: "Forecast a time series",
        description:
          "Runs Timestral over one or more series that share time steps and returns quantile forecasts. Known covariates must cover the history and the horizon; past covariates cover the history only.",
        middleware: [requireExperience("featured-forecasts")],
        querySchema: projectScopeQuerySchema,
        bodySchema: timeSeriesForecastRequestSchema,
        responses: {
          200: { description: "The forecast", schema: timeSeriesForecastSchema },
          400: { description: "Bad request", schema: errorResponseSchema },
        },
        handler: ({ body, raw, serviceContext }) =>
          forecastTimeSeries(serviceContext.env, body, raw.req.raw.signal),
      });
    },
  );
}
