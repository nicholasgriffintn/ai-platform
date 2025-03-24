import type { IFunction, IRequest } from "../../types";
import { getWeatherForLocation } from "../apps/weather";

export const get_weather: IFunction = {
  name: "get_weather",
  description:
    "Retrieves current weather conditions and forecasts for a specified location. Use when users ask about weather, temperature, or climate conditions for a specific place. Requires a location (city, region, or coordinates).",
  parameters: {
    type: "object",
    properties: {
      longitude: {
        type: "number",
        description: "The longitude to get the weather for",
      },
      latitude: {
        type: "number",
        description: "The latitude to get the weather for",
      },
    },
    required: ["longitude", "latitude"],
  },
  function: async (
    completion_id: string,
    args: any,
    req: IRequest,
    app_url?: string,
  ) => {
    const location = {
      longitude: args.longitude || args.lat,
      latitude: args.latitude || args.lon,
    };

    if (!location.longitude || !location.latitude) {
      return {
        status: "error",
        name: "get_weather",
        content: "Missing location",
        data: {},
      };
    }

    const data = await getWeatherForLocation(req.env, location);
    return data;
  },
};
