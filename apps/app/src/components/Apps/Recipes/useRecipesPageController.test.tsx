import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantRecipe, RecipeInstallation } from "@assistant/schemas";

import { useRecipesPageController } from "./useRecipesPageController";

const mocks = vi.hoisted(() => ({
	recipes: vi.fn(),
	installations: vi.fn(),
	recipeConnectors: vi.fn(),
	navigate: vi.fn(),
}));

vi.mock("~/hooks/useRecipes", () => ({
	ASSISTANT_RECIPES_QUERY_KEY: ["assistant-recipes"],
	useAssistantRecipes: () => ({
		data: { categories: [], recipes: mocks.recipes() },
		error: null,
		isLoading: false,
		isRefetching: false,
		refetch: vi.fn(),
	}),
	useRecipeInstallations: () => ({
		data: { installations: mocks.installations() },
	}),
	useDeleteRecipeInstallation: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	useInstallAssistantRecipe: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	useInvokeAssistantRecipe: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	useUpdateRecipeInstallation: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
}));

vi.mock("~/hooks/useConnectors", () => ({
	RECIPE_CONNECTORS_QUERY_KEY: ["recipe-connectors"],
	useRecipeConnectors: () => ({
		data: { connectors: mocks.recipeConnectors() },
	}),
	useStartRecipeConnector: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
}));

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		info: vi.fn(),
		success: vi.fn(),
	},
}));

const morningBriefingRecipe = {
	id: "morning-briefing",
	title: "Morning Briefing",
	summary: "Summarise your day",
	description: "Uses mail and calendar",
	kind: "automate",
	category: "Productivity",
	featured: true,
	estimatedSetupMinutes: 5,
	integrations: [],
	triggers: [{ type: "schedule", label: "Daily", description: "Run daily" }],
	actions: ["Summarise priorities"],
	setupPrompt: "Set up the Morning Briefing recipe.",
	enabledTools: ["use_recipe_connector"],
	configurationFields: [],
} satisfies AssistantRecipe;

const morningBriefingInstallation = {
	id: "installation-1",
	recipeId: "morning-briefing",
	userId: 42,
	status: "active",
	triggers: [{ type: "manual", enabled: true }],
	configuration: {},
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
} satisfies RecipeInstallation;

function wrapper({ children }: { children: ReactNode }) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});

	return (
		<QueryClientProvider client={queryClient}>
			<MemoryRouter initialEntries={["/apps/recipes?action=schedule&recipe=morning-briefing"]}>
				{children}
			</MemoryRouter>
		</QueryClientProvider>
	);
}

describe("useRecipesPageController", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.recipes.mockReturnValue([morningBriefingRecipe]);
		mocks.installations.mockReturnValue([morningBriefingInstallation]);
		mocks.recipeConnectors.mockReturnValue([]);
	});

	it("opens the schedule workflow requested by an assistant action launch", async () => {
		const { result } = renderHook(() => useRecipesPageController(), { wrapper });

		await waitFor(() => {
			expect(result.current.scheduleDialog.recipe?.id).toBe("morning-briefing");
		});
		expect(result.current.scheduleDialog.hasExistingSchedule).toBe(false);
		expect(result.current.scheduleDialog.prompt).toBe("Set up the Morning Briefing recipe.");
	});
});
