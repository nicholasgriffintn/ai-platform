import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { normaliseWeatherForecast } from "~/modules/connectors/domain/weather";

import { closeComposioConnectorRun } from "./composio-run";
import { executeRecipeConnectorOperation } from "./operations";

const weatherSchema = z
  .object({
    dt: z.number().int().positive(),
    cod: z.literal(200),
    main: z.object({ temp: z.number().finite() }).passthrough(),
    weather: z
      .array(z.object({ id: z.number(), main: z.string(), description: z.string() }).passthrough())
      .min(1),
    wind: z.object({ speed: z.number().finite() }).passthrough().optional(),
  })
  .passthrough();
const forecastSchema = z.object({
  cod: z.union([z.string(), z.number()]),
  list: z.array(
    z.object({
      dt: z.number(),
      main: z.object({
        temp: z.number(),
        temp_min: z.number(),
        temp_max: z.number(),
        humidity: z.number().optional(),
      }),
      weather: z.array(z.object({ description: z.string(), icon: z.string().optional() })),
      wind: z.object({ speed: z.number() }).optional(),
      pop: z.number().optional(),
    }),
  ),
});

export async function readConnectorWeather(
  context: ServiceContext,
  location: { latitude: number; longitude: number },
  options: { forecast?: boolean } = {},
) {
  const request = (operation: string) =>
    executeRecipeConnectorOperation({
      context,
      userId: context.requireUser().id,
      request: {
        provider: "openweather_api",
        operation,
        params: { lat: location.latitude, lon: location.longitude, units: "metric" },
      },
    });

  try {
    const weather = z
      .object({ data: weatherSchema })
      .parse(await request("OPENWEATHER_API_GET_CURRENT_WEATHER")).data;
    const forecast = options.forecast
      ? await request("OPENWEATHER_API_GET5_DAY_FORECAST")
          .then((response) =>
            normaliseWeatherForecast(z.object({ data: forecastSchema }).parse(response).data),
          )
          .catch(() => undefined)
      : undefined;

    return { ...weather, ...(forecast ? { forecast } : {}) };
  } finally {
    await closeComposioConnectorRun(context);
  }
}
