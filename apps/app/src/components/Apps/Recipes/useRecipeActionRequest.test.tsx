import { renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { AssistantRecipe, RecipeInstallation } from "@assistant/schemas";

import { useRecipeActionRequest } from "./useRecipeActionRequest";

const recipe = {
	id: "morning-briefing",
	title: "Morning Briefing",
	summary: "Summarise your day",
	description: "Uses mail and calendar",
	kind: "automate",
	category: "Productivity",
	featured: true,
	estimatedSetupMinutes: 5,
	integrations: [],
	triggers: [],
	actions: [],
	setupPrompt: "Configure the recipe",
	enabledTools: [],
	configurationFields: [],
} satisfies AssistantRecipe;

const installation = {
	id: "installation-1",
	recipeId: recipe.id,
	userId: 42,
	status: "active",
	triggers: [{ type: "manual", enabled: true }],
	configuration: {},
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
} satisfies RecipeInstallation;

function wrapper(initialEntry: string) {
	return ({ children }: { children: ReactNode }) => (
		<MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
	);
}

describe("useRecipeActionRequest", () => {
	it.each([
		["configure", "openConfigurationDialog"],
		["schedule", "openScheduleDialog"],
	] as const)("opens %s in the original recipe workflow", async (action, handler) => {
		const actions = {
			openConfigurationDialog: vi.fn(),
			openScheduleDialog: vi.fn(),
		};

		renderHook(
			() => useRecipeActionRequest([recipe], new Map([[recipe.id, installation]]), actions),
			{
				wrapper: wrapper(
					`/work/workspace-1/projects/project-1/library?action=${action}&recipe=${recipe.id}`,
				),
			},
		);

		await waitFor(() => expect(actions[handler]).toHaveBeenCalledWith(recipe, installation));
	});
});
