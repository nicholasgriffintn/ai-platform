import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const get_weather: FunctionToolDescriptor = {
  name: "get_weather",
  description:
    "Retrieves current weather conditions and forecasts for a specified location. Use when users ask about weather, temperature, or climate conditions for a specific place. Requires a location (city, region, or coordinates).",
  inputSchema: jsonSchemaToZod({
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
  }),
  type: "normal",
  permissions: ["read"],
};
