import z from "zod/v4";

export const TIMESTRAL_MODEL = "timestral-209m";
export const TIMESTRAL_QUANTILE_LEVELS = [
  0.01, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8,
  0.85, 0.9, 0.95, 0.99,
] as const;
export const DEFAULT_FORECAST_QUANTILES = [0.1, 0.25, 0.5, 0.75, 0.9] as const;
export const FORECAST_MEDIAN_LEVEL = 0.5;
export const FORECAST_MAX_CONTEXT = 32_768;
export const FORECAST_MIN_CONTEXT = 3;
export const FORECAST_MAX_HORIZON = 1_024;
export const FORECAST_MAX_TARGETS = 8;
export const FORECAST_MAX_COVARIATES = 8;

const quantileLevels: readonly number[] = TIMESTRAL_QUANTILE_LEVELS;

export const forecastQuantileLevelSchema = z
  .number()
  .refine((level) => quantileLevels.includes(level), {
    message: `Quantile levels must be one of ${TIMESTRAL_QUANTILE_LEVELS.join(", ")}`,
  });

const observationSchema = z.number().nullable();
const observationsSchema = z
  .array(observationSchema)
  .max(FORECAST_MAX_CONTEXT + FORECAST_MAX_HORIZON);
const seriesNameSchema = z.string().trim().min(1).max(80);
const horizonSchema = z.number().int().min(1).max(FORECAST_MAX_HORIZON);

export const forecastNamedValuesSchema = z
  .object({ name: seriesNameSchema, values: observationsSchema })
  .strict();

export const timeSeriesForecastRequestSchema = z
  .object({
    series: z.array(forecastNamedValuesSchema).min(1).max(FORECAST_MAX_TARGETS),
    horizon: horizonSchema,
    timestamps: z.array(z.string().max(64)).max(FORECAST_MAX_CONTEXT).optional(),
    pastCovariates: z.array(forecastNamedValuesSchema).max(FORECAST_MAX_COVARIATES).optional(),
    knownCovariates: z.array(forecastNamedValuesSchema).max(FORECAST_MAX_COVARIATES).optional(),
    quantiles: z
      .array(forecastQuantileLevelSchema)
      .min(1)
      .max(TIMESTRAL_QUANTILE_LEVELS.length)
      .optional(),
  })
  .strict()
  .superRefine((request, context) => {
    const length = request.series[0]?.values.length ?? 0;

    if (length < FORECAST_MIN_CONTEXT || length > FORECAST_MAX_CONTEXT) {
      context.addIssue({
        code: "custom",
        path: ["series"],
        message: `Each series needs between ${FORECAST_MIN_CONTEXT} and ${FORECAST_MAX_CONTEXT} values`,
      });
    }

    request.series.forEach((series, index) => {
      if (series.values.length !== length) {
        context.addIssue({
          code: "custom",
          path: ["series", index, "values"],
          message: "Every series must cover the same time steps",
        });
      }

      if (series.values.filter((value) => value !== null).length < 2) {
        context.addIssue({
          code: "custom",
          path: ["series", index, "values"],
          message: "A series needs at least two observed values",
        });
      }
    });

    if (new Set(request.series.map(({ name }) => name)).size !== request.series.length) {
      context.addIssue({
        code: "custom",
        path: ["series"],
        message: "Give each series its own name",
      });
    }

    if (request.timestamps && request.timestamps.length !== length) {
      context.addIssue({
        code: "custom",
        path: ["timestamps"],
        message: "Timestamps must line up with the series values",
      });
    }

    request.pastCovariates?.forEach((covariate, index) => {
      if (covariate.values.length !== length) {
        context.addIssue({
          code: "custom",
          path: ["pastCovariates", index, "values"],
          message: "Past covariates must cover exactly the history",
        });
      }
    });

    request.knownCovariates?.forEach((covariate, index) => {
      if (covariate.values.length !== length + request.horizon) {
        context.addIssue({
          code: "custom",
          path: ["knownCovariates", index, "values"],
          message: "Known covariates must cover the history and the horizon",
        });
      }
    });

    const covariates =
      (request.pastCovariates?.length ?? 0) + (request.knownCovariates?.length ?? 0);

    if (covariates > FORECAST_MAX_COVARIATES) {
      context.addIssue({
        code: "custom",
        path: ["knownCovariates"],
        message: `Use at most ${FORECAST_MAX_COVARIATES} covariates in total`,
      });
    }
  });

const forecastQuantileSchema = z
  .object({ level: forecastQuantileLevelSchema, values: z.array(z.number()) })
  .strict();

export const forecastSeriesSchema = z
  .object({ name: seriesNameSchema, quantiles: z.array(forecastQuantileSchema).min(1) })
  .strict();

export const timeSeriesForecastSchema = z
  .object({
    model: z.string(),
    horizon: horizonSchema,
    timestamps: z.array(z.string()).nullable(),
    series: z.array(forecastSeriesSchema).min(1),
    elapsedMs: z.number().nonnegative(),
  })
  .strict();

export const timeSeriesForecastViewSchema = timeSeriesForecastSchema
  .extend({
    history: z
      .object({
        timestamps: z.array(z.string()).nullable(),
        series: z.array(forecastNamedValuesSchema),
      })
      .strict(),
  })
  .strict();

const forecasterRowsSchema = z.array(observationsSchema).max(FORECAST_MAX_COVARIATES);

export const forecasterRequestSchema = z
  .object({
    targets: z.array(observationsSchema).min(1).max(FORECAST_MAX_TARGETS),
    pastCovariates: forecasterRowsSchema,
    knownCovariates: forecasterRowsSchema,
    horizon: horizonSchema,
    quantiles: z.array(forecastQuantileLevelSchema).min(1).max(TIMESTRAL_QUANTILE_LEVELS.length),
  })
  .strict();

export const forecasterResultSchema = z
  .object({
    model: z.string(),
    quantiles: z.array(forecastQuantileLevelSchema).min(1),
    values: z.array(z.array(z.array(z.number()))).min(1),
    elapsedMs: z.number().nonnegative(),
  })
  .strict();

export type ForecastNamedValues = z.infer<typeof forecastNamedValuesSchema>;
export type TimeSeriesForecastRequest = z.infer<typeof timeSeriesForecastRequestSchema>;
export type ForecastSeries = z.infer<typeof forecastSeriesSchema>;
export type TimeSeriesForecast = z.infer<typeof timeSeriesForecastSchema>;
export type TimeSeriesForecastView = z.infer<typeof timeSeriesForecastViewSchema>;
export type ForecasterRequest = z.infer<typeof forecasterRequestSchema>;
export type ForecasterResult = z.infer<typeof forecasterResultSchema>;
