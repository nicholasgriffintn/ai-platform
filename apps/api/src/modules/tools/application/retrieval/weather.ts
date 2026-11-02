import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { readConnectorWeather } from "~/modules/connectors/application/weather";
import type { IFunctionResponse } from "~/types";

export async function getWeatherForLocation(
  context: ServiceContext,
  location: { latitude: number; longitude: number },
): Promise<IFunctionResponse> {
  const weather = await readConnectorWeather(context, location, { forecast: true });

  return {
    status: "success",
    name: "get_weather",
    content: `The current temperature is ${weather.main.temp}°C with ${weather.weather[0]?.main}`,
    data: weather,
  };
}
