import { placeSearchQuerySchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import type { ApiToolDefinition } from "~/types/functions";

import { searchConnectorPlaces } from "../places";

const inputSchema = placeSearchQuerySchema.extend({ provider: z.enum(["openweather_api", "tfl"]) });

export const search_places: ApiToolDefinition = {
  name: "search_places",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  description:
    "Find a town or city with connected OpenWeather, or a London station or stop with TfL. Ask the person to choose ambiguous results. Use returned coordinates for weather or commute preferences; never invent coordinates or infer private addresses. Connect OpenWeather first if it is disconnected. TfL supports public access without credentials.",
  inputSchema,
  execute: async (args: z.infer<typeof inputSchema>, toolContext) => {
    const context = toolContext.request.context;

    if (!context) {
      throw new AssistantError("Sign in to search places", ErrorType.AUTHENTICATION_ERROR, 401);
    }

    const data = await searchConnectorPlaces(context, args.provider, args.query);

    return {
      name: "search_places",
      status: "success",
      content: data.places.length
        ? `Matching places:\n${data.places.map((place) => `- ${place.label}`).join("\n")}`
        : "No matching places found. Try a more specific town, station or stop name.",
      data: { ...data, responseType: "text" },
    };
  },
};
