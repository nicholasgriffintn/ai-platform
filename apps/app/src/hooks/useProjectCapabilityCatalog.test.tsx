import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AssistantRecipe } from "@assistant/schemas";

import { useProjectCapabilityCatalog } from "./useProjectCapabilityCatalog";

const mocks = vi.hoisted(() => ({ appsData: vi.fn(), recipes: vi.fn() }));

const recipe = {
	id: "daily-briefing",
	title: "Daily Briefing",
	summary: "Summarise the day",
	description: "Build a daily summary",
	kind: "automate",
	category: "Productivity",
	featured: true,
	estimatedSetupMinutes: 5,
	integrations: [],
	triggers: [],
	actions: ["Summarise"],
	setupPrompt: "Set up a daily briefing",
	enabledTools: [],
	configurationFields: [],
} satisfies AssistantRecipe;

vi.mock("./useDynamicApps", () => ({
	useDynamicApps: () => ({
		data: mocks.appsData(),
		error: null,
		isLoading: false,
	}),
}));
vi.mock("./useRecipes", () => ({
	useAssistantRecipes: () => ({
		data: {
			categories: ["Productivity"],
			filters: ["automate"],
			recipes: mocks.recipes(),
		},
		error: null,
		isLoading: false,
	}),
}));

describe("useProjectCapabilityCatalog", () => {
	it("uses API metadata and includes every recipe rather than only installations", () => {
		mocks.appsData.mockReturnValue({
			apps: [
				{
					id: "notes-app",
					name: "Notes",
					description: "Write notes",
					kind: "frontend",
					category: "Productivity",
				},
			],
			experiences: [],
			tools: [
				{
					id: "web_fetch",
					capability: "supportsWebFetch",
					category: "Research",
					command: "web fetch",
					description: "Fetch URLs",
					label: "Web fetch",
				},
			],
		});
		mocks.recipes.mockReturnValue([
			recipe,
			{ ...recipe, id: "weekly-briefing", title: "Weekly Briefing" },
		]);
		const { result } = renderHook(() => useProjectCapabilityCatalog());

		expect(
			result.current.items
				.filter((item) => item.kind === "recipe")
				.map((item) => item.capability.id),
		).toEqual(["daily-briefing", "weekly-briefing"]);
		expect(result.current.items).toContainEqual(
			expect.objectContaining({
				label: "Notes",
				metadata: expect.objectContaining({ category: "Productivity" }),
			}),
		);
		expect(result.current.items).toContainEqual(
			expect.objectContaining({
				label: "Web fetch",
				metadata: expect.objectContaining({ category: "Research" }),
			}),
		);
	});
});
