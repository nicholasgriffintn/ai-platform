import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { AssistantRecipe, RecipeInstallation } from "@assistant/schemas";

import type { useRecipeWorkflows } from "~/components/Apps/Recipes/useRecipeWorkflows";
import { ProjectRecipeCapabilityCard } from "./ProjectRecipeCapabilityCard";

const recipe = {
	id: "morning-briefing",
	title: "Morning Briefing",
	summary: "Summarise your day",
	description: "Uses mail and calendar",
	kind: "automate",
	category: "Productivity",
	featured: false,
	estimatedSetupMinutes: 5,
	integrations: [],
	triggers: [{ type: "schedule", label: "Daily", description: "Run daily" }],
	actions: ["Summarise priorities"],
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

function createWorkflows() {
	return {
		configurationDialog: {
			recipe: null,
			installation: null,
			values: {},
			setValues: vi.fn(),
			close: vi.fn(),
			submit: vi.fn(),
			isLoading: false,
		},
		scheduleDialog: {
			recipe: null,
			hasExistingSchedule: false,
			cronExpression: "0 9 * * *",
			prompt: "",
			notifySms: false,
			smsTarget: "",
			setCronExpression: vi.fn(),
			setPrompt: vi.fn(),
			setNotifySms: vi.fn(),
			setSmsTarget: vi.fn(),
			close: vi.fn(),
			submit: vi.fn(),
			isLoading: false,
		},
		deleteDialog: {
			installation: null,
			setInstallation: vi.fn(),
			submit: vi.fn(),
			isLoading: false,
		},
		actions: {
			start: vi.fn(),
			configureProvider: vi.fn(),
			openConfigurationDialog: vi.fn(),
			openScheduleDialog: vi.fn(),
			toggleInstallationStatus: vi.fn(),
			getRecipeCardState: vi.fn().mockReturnValue({
				installation,
				isStarting: false,
				isConfiguring: false,
				isEditingConfiguration: false,
				isScheduling: false,
				isUpdatingInstallation: false,
			}),
		},
	} satisfies ReturnType<typeof useRecipeWorkflows>;
}

describe("ProjectRecipeCapabilityCard", () => {
	it("retains the complete original recipe lifecycle inside project capabilities", () => {
		const workflows = createWorkflows();
		const onRemove = vi.fn();

		render(
			<MemoryRouter>
				<ProjectRecipeCapabilityCard
					canManage
					capability={{
						id: "capability-1",
						projectId: "project-1",
						kind: "recipe",
						capabilityId: recipe.id,
						configuration: {},
						createdAt: "2026-01-01",
					}}
					installation={installation}
					isAdding={false}
					isRemoving={false}
					onAdd={vi.fn()}
					onRemove={onRemove}
					recipe={recipe}
					workflows={workflows}
				/>
			</MemoryRouter>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Run in chat" }));
		fireEvent.click(screen.getByRole("button", { name: "Edit configuration" }));
		fireEvent.click(screen.getByRole("button", { name: "Schedule" }));
		fireEvent.click(screen.getByRole("button", { name: "Pause" }));
		fireEvent.click(screen.getByRole("button", { name: "Remove" }));

		expect(workflows.actions.start).toHaveBeenCalledWith(recipe, installation);
		expect(workflows.actions.openConfigurationDialog).toHaveBeenCalledWith(recipe, installation);
		expect(workflows.actions.openScheduleDialog).toHaveBeenCalledWith(recipe, installation);
		expect(workflows.actions.toggleInstallationStatus).toHaveBeenCalledWith(installation);
		expect(workflows.deleteDialog.setInstallation).toHaveBeenCalledWith(installation);

		fireEvent.click(screen.getByRole("button", { name: "Recipe project actions" }));
		fireEvent.click(screen.getByRole("menuitem", { name: "Remove from project" }));
		expect(onRemove).toHaveBeenCalledTimes(1);
	});
});
