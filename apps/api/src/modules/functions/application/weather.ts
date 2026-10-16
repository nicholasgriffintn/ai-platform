import { getWeatherForLocation } from "~/modules/tools/application/retrieval/weather";
import type { ApiToolDefinition } from "~/types/functions";

import { get_weather as get_weatherDescriptor } from "./definitions/weather";
import { resolveUserCoordinates } from "./user-location";

export const get_weather: ApiToolDefinition = {
  ...get_weatherDescriptor,
  execute: async (args, context) => {
    const req = context.request;
    const latitude = args.latitude ?? args.lat;
    const longitude = args.longitude ?? args.lon;
    const location =
      typeof latitude === "number" && typeof longitude === "number"
        ? { latitude, longitude }
        : resolveUserCoordinates(req);

    if (!location) {
      return {
        status: "error",
        name: "get_weather",
        content: "No location given and the user's location is not available. Ask where they are.",
        data: {},
      };
    }

    return getWeatherForLocation(req.env, {
      latitude: location.latitude,
      longitude: location.longitude,
    });
  },
};
