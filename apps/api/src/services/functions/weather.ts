import { getWeatherForLocation } from "~/services/apps/retrieval/weather";
import type { IRequest } from "~/types";
import { jsonSchemaToZod } from "./jsonSchema";
import type { ApiToolDefinition } from "./types";

export const get_weather: ApiToolDefinition = {
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
	costPerCall: 0,
	permissions: ["read"],
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
