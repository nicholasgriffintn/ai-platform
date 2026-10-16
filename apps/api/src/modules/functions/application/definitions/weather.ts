import { jsonSchemaToZod } from "@ngriffin_uk/polychat-library-tools";

import type { FunctionToolDescriptor } from "./types";

export const get_weather: FunctionToolDescriptor = {
  name: "get_weather",
  description:
    "Retrieves current weather conditions and forecasts for a location. Use when users ask about weather, temperature, or climate conditions. Pass coordinates for a specific place; omit them to use the user's own location.",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      longitude: {
        type: "number",
        description: "The longitude to get the weather for. Omit to use the user's location.",
      },
      latitude: {
        type: "number",
        description: "The latitude to get the weather for. Omit to use the user's location.",
      },
    },
  }),
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
};
