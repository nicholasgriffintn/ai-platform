import { describe, expect, it } from "vitest";
import type { AssistantRecipe, RecipeInstallation } from "@assistant/schemas";

import { getMissingRequiredRecipeConfigurationFields } from "./recipes";

const baseRecipe = {
	id: "daily-weather",
	title: "Daily Weather",
	summary: "Get a forecast",
	description: "Get a forecast",
	kind: "automate",
	category: "Productivity",
	featured: false,
	estimatedSetupMinutes: 2,
	integrations: [],
	triggers: [{ type: "schedule", label: "Daily", description: "Run daily" }],
	actions: [],
	setupPrompt: "Set up weather",
	enabledTools: ["get_weather"],
	configurationFields: [
		{
			key: "location",
			label: "Location",
			type: "text",
			required: true,
		},
		{
			key: "units",
			label: "Units",
			type: "text",
			defaultValue: "Celsius",
			required: true,
		},
	],
} satisfies AssistantRecipe;

describe("recipe helpers", () => {
	it("detects missing required configuration fields for scheduling", () => {
		expect(
			getMissingRequiredRecipeConfigurationFields(baseRecipe).map((field) => field.key),
		).toEqual(["location"]);
	});

	it("uses saved installation configuration when checking required fields", () => {
		const installation = {
			id: "installation-1",
			recipeId: "daily-weather",
			userId: 42,
			status: "active",
			triggers: [],
			configuration: {
				location: "London",
			},
			createdAt: "2026-06-08T10:00:00.000Z",
			updatedAt: "2026-06-08T10:00:00.000Z",
		} satisfies RecipeInstallation;

		expect(getMissingRequiredRecipeConfigurationFields(baseRecipe, installation)).toEqual([]);
	});
});
