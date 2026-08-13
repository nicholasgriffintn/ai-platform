import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantRecipe, RecipeInstallation } from "@assistant/schemas";

import { useRecipeWorkflows } from "./useRecipeWorkflows";

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	launchAssistantAction: vi.fn(),
	installRecipe: {
		mutateAsync: vi.fn(),
		isPending: false,
		variables: undefined as { recipeId?: string } | undefined,
	},
	invokeRecipe: {
		mutateAsync: vi.fn(),
		isPending: false,
		variables: undefined as { recipeId?: string } | undefined,
	},
	updateInstallation: {
		mutateAsync: vi.fn(),
		isPending: false,
		variables: undefined as { installationId?: string; update?: unknown } | undefined,
	},
	deleteInstallation: {
		mutateAsync: vi.fn(),
		isPending: false,
	},
	startConnector: {
		mutateAsync: vi.fn(),
		isPending: false,
	},
	recipeConnectors: vi.fn(),
}));

vi.mock("react-router", () => ({
	useLocation: () => ({
		pathname: "/work/workspace-1/projects/project-1/library",
		search: "",
	}),
	useNavigate: () => mocks.navigate,
}));

vi.mock("~/hooks/useRecipes", () => ({
	ASSISTANT_RECIPES_QUERY_KEY: ["assistant-recipes"],
	useDeleteRecipeInstallation: () => mocks.deleteInstallation,
	useInstallAssistantRecipe: () => mocks.installRecipe,
	useInvokeAssistantRecipe: () => mocks.invokeRecipe,
	useUpdateRecipeInstallation: () => mocks.updateInstallation,
}));

vi.mock("~/hooks/useConnectors", () => ({
	RECIPE_CONNECTORS_QUERY_KEY: ["recipe-connectors"],
	useRecipeConnectors: () => ({
		data: { connectors: mocks.recipeConnectors() },
	}),
	useStartRecipeConnector: () => mocks.startConnector,
}));

vi.mock("~/lib/assistant-action-flow", () => ({
	launchAssistantAction: mocks.launchAssistantAction,
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
	triggers: [{ type: "message", label: "Ask", description: "Ask for it" }],
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

const configuredRecipe = {
	...morningBriefingRecipe,
	id: "daily-weather",
	title: "Daily Weather",
	setupPrompt: "Prepare the daily weather forecast.",
	triggers: [{ type: "schedule", label: "Daily", description: "Run every day" }],
	configurationFields: [
		{
			key: "location",
			label: "Location",
			type: "text",
			required: true,
		},
	],
} satisfies AssistantRecipe;

function wrapper({ children }: { children: ReactNode }) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});

	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useRecipeWorkflows", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.launchAssistantAction.mockResolvedValue({
			kind: "conversation",
			input: "Run the Morning Briefing recipe.",
			selectedTools: ["use_recipe_connector"],
			requestOptions: {
				recipe: {
					id: "morning-briefing",
					installationId: "installation-1",
					channel: "web",
					allowedConnectorProviders: [],
					allowedConnectorOperations: {},
					configuration: {},
				},
			},
			url: "/?query=Run+the+Morning+Briefing+recipe.&enabled_tools=use_recipe_connector&auto_submit=1&assistant_action_context=%7B%7D",
		});
		mocks.recipeConnectors.mockReturnValue([]);
		mocks.startConnector.mutateAsync.mockResolvedValue({
			provider: "posthog",
			authorizationUrl: "https://posthog.example/oauth",
		});
	});

	it("starts installed recipes through the shared assistant action execution path", async () => {
		const { result } = renderHook(
			() =>
				useRecipeWorkflows({
					conversationPath: "/work/workspace-1/projects/project-1/chat",
				}),
			{ wrapper },
		);

		await act(async () => {
			await result.current.actions.start(morningBriefingRecipe, morningBriefingInstallation);
		});

		expect(mocks.launchAssistantAction).toHaveBeenCalledWith(
			{
				conversationPath: "/work/workspace-1/projects/project-1/chat",
				delivery: "conversation",
				input: "",
				item: expect.objectContaining({
					id: "installed_recipe:installation-1",
					kind: "installed_recipe",
					label: "Morning Briefing",
					metadata: expect.objectContaining({
						installationId: "installation-1",
						recipeId: "morning-briefing",
					}),
				}),
				selectedTools: [],
			},
			expect.any(Object),
		);
		expect(mocks.navigate).toHaveBeenCalledWith(
			expect.stringContaining("assistant_action_context="),
		);
		expect(mocks.navigate).toHaveBeenCalledWith(
			expect.stringContaining("enabled_tools=use_recipe_connector"),
		);
		expect(mocks.installRecipe.mutateAsync).not.toHaveBeenCalled();
		expect(mocks.invokeRecipe.mutateAsync).not.toHaveBeenCalled();
	});

	it("connects recipe integration providers through the shared assistant action execution path", async () => {
		mocks.recipeConnectors.mockReturnValue([
			{
				id: "posthog",
				name: "PostHog",
				description: "Query product analytics",
				authType: "api_key",
				status: "unconfigured",
				scopes: ["project:read"],
				operations: ["query"],
			},
		]);
		mocks.launchAssistantAction.mockResolvedValue({
			kind: "navigation",
			input: "",
			path: "/profile?tab=providers&type=connector&connector=posthog",
		});
		const { result } = renderHook(() => useRecipeWorkflows(), { wrapper });

		await act(async () => {
			await result.current.actions.configureProvider("posthog");
		});

		expect(mocks.launchAssistantAction).toHaveBeenCalledWith(
			{
				delivery: "conversation",
				input: "",
				item: expect.objectContaining({
					id: "connector:posthog",
					kind: "connector",
					label: "PostHog",
					metadata: {
						authType: "api_key",
						provider: "posthog",
					},
				}),
				connectorReturnTo: "/work/workspace-1/projects/project-1/library",
				selectedTools: [],
			},
			expect.any(Object),
		);
		expect(mocks.navigate).toHaveBeenCalledWith(
			"/profile?tab=providers&type=connector&connector=posthog",
		);
		expect(mocks.startConnector.mutateAsync).not.toHaveBeenCalled();
	});

	it("opens event management only for connected Composio recipe integrations", () => {
		mocks.recipeConnectors.mockReturnValue([
			{
				id: "github",
				name: "GitHub",
				description: "Repository automation",
				authType: "composio",
				status: "connected",
				scopes: [],
				toolCount: 10,
				readToolCount: 6,
				writeToolCount: 4,
			},
		]);
		const eventRecipe = {
			...morningBriefingRecipe,
			integrations: [
				{
					id: "github",
					providerId: "github",
					name: "Work GitHub",
					description: "Repository events",
					connectionStatus: "connected",
					requiresConnection: true,
				},
			],
			triggers: [{ type: "event", label: "Repository event", description: "Run on change" }],
		} satisfies AssistantRecipe;
		const { result } = renderHook(() => useRecipeWorkflows(), { wrapper });

		act(() =>
			result.current.actions.openEventTriggersDialog(eventRecipe, morningBriefingInstallation),
		);

		expect(result.current.eventDialog.recipe).toBe(eventRecipe);
		expect(result.current.eventDialog.installation).toBe(morningBriefingInstallation);
		expect(result.current.eventDialog.providers).toEqual([{ id: "github", name: "Work GitHub" }]);
	});

	it("continues scheduling with the configuration returned by the save", async () => {
		const savedInstallation = {
			...morningBriefingInstallation,
			id: "installation-weather",
			recipeId: configuredRecipe.id,
			projectId: "project-1",
			configuration: { location: "London" },
		} satisfies RecipeInstallation;
		mocks.installRecipe.mutateAsync.mockResolvedValue({ installation: savedInstallation });
		const { result } = renderHook(() => useRecipeWorkflows({ projectId: "project-1" }), {
			wrapper,
		});

		act(() => result.current.actions.openScheduleDialog(configuredRecipe));
		expect(result.current.configurationDialog.recipe).toBe(configuredRecipe);
		expect(result.current.scheduleDialog.recipe).toBeNull();

		act(() => result.current.configurationDialog.setValues({ location: "London" }));
		await act(async () => result.current.configurationDialog.submit());

		expect(mocks.installRecipe.mutateAsync).toHaveBeenCalledWith({
			recipeId: configuredRecipe.id,
			projectId: "project-1",
			configuration: { location: "London" },
		});
		expect(result.current.configurationDialog.recipe).toBeNull();
		expect(result.current.scheduleDialog.recipe).toBe(configuredRecipe);
		expect(result.current.scheduleDialog.prompt).toBe(configuredRecipe.setupPrompt);
	});

	it("pauses and stops only the scheduled trigger", async () => {
		const scheduledInstallation = {
			...morningBriefingInstallation,
			triggers: [
				{ type: "manual", enabled: true },
				{ type: "schedule", enabled: true, cronExpression: "0 9 * * *" },
			],
		} satisfies RecipeInstallation;
		mocks.updateInstallation.mutateAsync.mockResolvedValue(scheduledInstallation);
		const { result } = renderHook(() => useRecipeWorkflows(), { wrapper });

		await act(async () => {
			await result.current.actions.setScheduleEnabled(scheduledInstallation, false);
		});
		expect(mocks.updateInstallation.mutateAsync).toHaveBeenLastCalledWith({
			installationId: scheduledInstallation.id,
			update: {
				status: "active",
				triggers: [
					{ type: "manual", enabled: true },
					{ type: "schedule", enabled: false, cronExpression: "0 9 * * *" },
				],
			},
		});

		await act(async () => {
			await result.current.actions.stopSchedule(scheduledInstallation);
		});
		expect(mocks.updateInstallation.mutateAsync).toHaveBeenLastCalledWith({
			installationId: scheduledInstallation.id,
			update: { triggers: [{ type: "manual", enabled: true }] },
		});
	});
});
