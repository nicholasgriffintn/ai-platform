import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	buildAssistantActionCatalog,
	createRecipeAssistantActionItem,
	type AssistantRecipe,
} from "@assistant/schemas";

import { useProjectLibraryController } from "./useProjectLibraryController";

const mocks = vi.hoisted(() => ({ add: vi.fn(), catalog: vi.fn(), remove: vi.fn() }));
const configuredRecipe = {
	id: "configured-recipe",
	title: "Configured Recipe",
	summary: "Needs project configuration",
	description: "Uses a saved topic",
	kind: "automate",
	category: "Productivity",
	featured: false,
	estimatedSetupMinutes: 5,
	integrations: [],
	triggers: [],
	actions: ["Summarise"],
	setupPrompt: "Configure the recipe",
	enabledTools: [],
	configurationFields: [
		{
			key: "topic",
			label: "Topic",
			type: "text",
			required: true,
		},
	],
} satisfies AssistantRecipe;
const recipeItem = createRecipeAssistantActionItem(configuredRecipe);

vi.mock("~/hooks/useProjectCapabilityCatalog", () => ({
	useProjectCapabilityCatalog: () => ({
		...mocks.catalog(),
	}),
}));
vi.mock("~/hooks/useRecipes", () => ({
	useRecipeInstallations: () => ({ data: { installations: [] } }),
}));
vi.mock("~/components/Apps/Recipes/useRecipeActionRequest", () => ({
	useRecipeActionRequest: vi.fn(),
}));
vi.mock("~/components/Apps/Recipes/useRecipeWorkflows", () => ({
	useRecipeWorkflows: () => ({
		actions: {},
		configurationDialog: {},
		deleteDialog: {},
		scheduleDialog: {},
	}),
}));
vi.mock("~/hooks/useWorkspaces", () => ({
	useAddProjectCapability: () => ({
		isPending: false,
		mutateAsync: mocks.add,
	}),
	useRemoveProjectCapability: () => ({
		isPending: false,
		mutate: mocks.remove,
	}),
}));
vi.mock("./WorkContext", () => ({
	useWorkData: () => ({
		projectQuery: { data: { capabilities: [], name: "Project" }, isLoading: false },
		workspaceQuery: { data: { role: "owner" } },
		workspacesQuery: { data: { workspaces: [] } },
	}),
}));

describe("useProjectLibraryController", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.add.mockResolvedValue({});
		mocks.catalog.mockReturnValue({
			apps: [],
			error: null,
			experiences: [],
			isLoading: false,
			items: [recipeItem],
			recipes: [configuredRecipe],
			tools: [],
		});
	});

	it("adds a recipe association without duplicating recipe installation configuration", async () => {
		const { result } = renderHook(() => useProjectLibraryController("workspace-1", "project-1"));

		act(() => {
			result.current.actions.addItem(recipeItem, "recipe");
		});
		await waitFor(() => {
			expect(mocks.add).toHaveBeenCalledTimes(1);
		});

		expect(mocks.add).toHaveBeenCalledWith({
			projectId: "project-1",
			input: {
				kind: "recipe",
				capabilityId: "configured-recipe",
				configuration: {},
			},
		});
	});

	it("stores validated configuration for API-defined project tools", async () => {
		const tool = {
			id: "file_search",
			capability: "supportsFileSearch",
			category: "Knowledge",
			command: "file search",
			configurationKind: "file_search",
			description: "Search configured vector stores",
			label: "File search",
			requiresConfiguration: true,
		} as const;
		const toolItem = buildAssistantActionCatalog({ modelTools: [tool] }).items[0];
		if (!toolItem) throw new Error("Expected file search catalogue item");
		mocks.catalog.mockReturnValue({
			apps: [],
			error: null,
			experiences: [],
			isLoading: false,
			items: [toolItem],
			recipes: [],
			tools: [tool],
		});
		const { result } = renderHook(() => useProjectLibraryController("workspace-1", "project-1"));

		act(() => result.current.toolConfigurationDialog.open(tool));
		await act(async () => {
			await result.current.toolConfigurationDialog.submit({ vectorStoreIds: ["vs_project"] });
		});

		expect(mocks.add).toHaveBeenCalledWith({
			projectId: "project-1",
			input: {
				kind: "tool",
				capabilityId: "file_search",
				configuration: { vectorStoreIds: ["vs_project"] },
			},
		});
	});
});
