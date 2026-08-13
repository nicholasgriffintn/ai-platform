import { renderHook } from "@testing-library/react";
import type { AssistantActionSelection } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAssistantActionSubmit } from "./useAssistantActionSubmit";

const mocks = vi.hoisted(() => ({
	startConnector: {
		mutateAsync: vi.fn(),
	},
	installRecipe: {
		mutateAsync: vi.fn(),
	},
	invokeRecipe: {
		mutateAsync: vi.fn(),
	},
	chatStore: {
		selectedAssistantAction: null as AssistantActionSelection | null,
		setSelectedAssistantAction: vi.fn(),
	},
	toolsStore: {
		selectedTools: [] as string[],
		setSelectedTools: vi.fn(),
	},
}));

vi.mock("~/hooks/useRecipes", () => ({
	useInstallAssistantRecipe: () => mocks.installRecipe,
	useInvokeAssistantRecipe: () => mocks.invokeRecipe,
}));

vi.mock("~/hooks/useConnectors", () => ({
	useStartRecipeConnector: () => mocks.startConnector,
}));

vi.mock("~/state/stores/chatStore", () => ({
	useChatStore: (selector: (state: typeof mocks.chatStore) => unknown) => selector(mocks.chatStore),
}));

vi.mock("~/state/stores/toolsStore", () => ({
	useToolsStore: (selector: (state: typeof mocks.toolsStore) => unknown) =>
		selector(mocks.toolsStore),
}));

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
	},
}));

describe("useAssistantActionSubmit", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.chatStore.selectedAssistantAction = null;
		mocks.installRecipe.mutateAsync.mockReset();
		mocks.invokeRecipe.mutateAsync.mockReset();
		mocks.startConnector.mutateAsync.mockReset();
		mocks.toolsStore.selectedTools = [];
	});

	it("invokes selected installed recipes and returns chat launch options", async () => {
		mocks.chatStore.selectedAssistantAction = {
			item: {
				id: "installed_recipe:installation-1",
				kind: "installed_recipe",
				label: "Daily Weather",
				metadata: {
					recipeId: "daily-weather",
				},
			},
		};
		mocks.invokeRecipe.mutateAsync.mockResolvedValue({
			recipeId: "daily-weather",
			installationId: "installation-1",
			channel: "web",
			status: "ready",
			conversationStarter: "Run the daily weather recipe.",
			messageUrl: "/?query=Run+the+daily+weather+recipe.",
			missingConnections: [],
			enabledTools: ["get_weather"],
			allowedConnectorProviders: [],
			allowedConnectorOperations: {},
			configuration: { location: "London" },
		});

		const { result } = renderHook(() => useAssistantActionSubmit());

		await expect(
			result.current.resolveAssistantActionSubmit("@Daily Weather today"),
		).resolves.toEqual({
			kind: "submit",
			input: "@Daily Weather today",
			requestOptions: {
				options: {
					recipe: {
						id: "daily-weather",
						installationId: "installation-1",
						channel: "web",
						allowedConnectorProviders: [],
						allowedConnectorOperations: {},
						configuration: { location: "London" },
					},
				},
			},
			selectedTools: ["get_weather"],
		});
		expect(mocks.invokeRecipe.mutateAsync).toHaveBeenCalledWith({
			recipeId: "daily-weather",
			input: "@Daily Weather today",
		});
		expect(mocks.toolsStore.setSelectedTools).toHaveBeenCalledWith(["get_weather"]);
		expect(mocks.chatStore.setSelectedAssistantAction).toHaveBeenCalledWith(null);
		expect(mocks.installRecipe.mutateAsync).not.toHaveBeenCalled();
	});

	it("keeps recipe invocation inside the current project", async () => {
		mocks.chatStore.selectedAssistantAction = {
			item: {
				id: "installed_recipe:installation-1",
				kind: "installed_recipe",
				label: "Daily Weather",
				metadata: { recipeId: "daily-weather" },
			},
		};
		mocks.invokeRecipe.mutateAsync.mockResolvedValue({
			recipeId: "daily-weather",
			installationId: "installation-1",
			channel: "web",
			status: "ready",
			conversationStarter: "Run the daily weather recipe.",
			messageUrl: "/?query=Run+the+daily+weather+recipe.",
			missingConnections: [],
			enabledTools: ["get_weather"],
			allowedConnectorProviders: [],
			allowedConnectorOperations: {},
			configuration: {},
		});

		const { result } = renderHook(() => useAssistantActionSubmit({ projectId: "project-1" }));
		await result.current.resolveAssistantActionSubmit("@Daily Weather today");

		expect(mocks.invokeRecipe.mutateAsync).toHaveBeenCalledWith({
			recipeId: "daily-weather",
			input: "@Daily Weather today",
			projectId: "project-1",
		});
	});

	it("does not treat compact as a chat request option", async () => {
		const { result } = renderHook(() => useAssistantActionSubmit());

		await expect(result.current.resolveAssistantActionSubmit("/compact")).resolves.toEqual({
			kind: "submit",
			input: "/compact",
		});
		expect(mocks.chatStore.setSelectedAssistantAction).not.toHaveBeenCalled();
	});

	it("routes scheduled recipe actions through the selected slash verb", async () => {
		mocks.chatStore.selectedAssistantAction = {
			verb: "schedule",
			item: {
				id: "installed_recipe:installation-1",
				kind: "installed_recipe",
				label: "Daily Weather",
				metadata: {
					recipeId: "daily-weather",
				},
			},
		};

		const { result } = renderHook(() =>
			useAssistantActionSubmit({
				recipeManagementPath: "/work/workspace-1/projects/project-1/library",
			}),
		);

		await expect(result.current.resolveAssistantActionSubmit("@Daily Weather")).resolves.toEqual({
			kind: "navigation",
			input: "@Daily Weather",
			path: "/work/workspace-1/projects/project-1/library?action=schedule&recipe=daily-weather",
		});
		expect(mocks.invokeRecipe.mutateAsync).not.toHaveBeenCalled();
		expect(mocks.installRecipe.mutateAsync).not.toHaveBeenCalled();
		expect(mocks.chatStore.setSelectedAssistantAction).toHaveBeenCalledWith(null);
	});

	it("enables selected tools without changing the prompt", async () => {
		mocks.toolsStore.selectedTools = ["web_fetch"];
		mocks.chatStore.selectedAssistantAction = {
			item: {
				id: "tool:code_execution",
				kind: "tool",
				label: "Code execution",
				metadata: {
					toolId: "code_execution",
				},
			},
		};

		const { result } = renderHook(() => useAssistantActionSubmit());

		await expect(
			result.current.resolveAssistantActionSubmit("run @Code execution this"),
		).resolves.toEqual({
			kind: "submit",
			input: "run @Code execution this",
			selectedTools: ["web_fetch", "code_execution"],
		});
		expect(mocks.toolsStore.setSelectedTools).toHaveBeenCalledWith(["web_fetch", "code_execution"]);
		expect(mocks.chatStore.setSelectedAssistantAction).toHaveBeenCalledWith(null);
	});

	it("uses a connected connector without starting setup again", async () => {
		mocks.chatStore.selectedAssistantAction = {
			item: {
				id: "connector:nasa",
				kind: "connector",
				label: "Nasa",
				launch: {
					kind: "tool_toggle",
					toolId: "use_recipe_connector",
				},
				metadata: {
					authType: "composio",
					provider: "nasa",
				},
			},
		};

		const { result } = renderHook(() => useAssistantActionSubmit());

		await expect(
			result.current.resolveAssistantActionSubmit("@Nasa show me something cool from space"),
		).resolves.toEqual({
			kind: "submit",
			input: "@Nasa show me something cool from space",
			requestOptions: {
				options: {
					connector: {
						provider: "nasa",
					},
				},
			},
			selectedTools: ["use_recipe_connector"],
		});
		expect(mocks.toolsStore.setSelectedTools).toHaveBeenCalledWith(["use_recipe_connector"]);
		expect(mocks.startConnector.mutateAsync).not.toHaveBeenCalled();
		expect(mocks.chatStore.setSelectedAssistantAction).toHaveBeenCalledWith(null);
	});
});
