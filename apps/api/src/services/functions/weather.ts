import { getWeatherForLocation } from "~/services/apps/retrieval/weather";

import type { ApiToolDefinition } from "../../types/functions";
import { get_weather as get_weatherDescriptor } from "./definitions/weather";

export const get_weather: ApiToolDefinition = {
  ...get_weatherDescriptor,
  execute: async (args, context) => {
    const req = context.request;
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
