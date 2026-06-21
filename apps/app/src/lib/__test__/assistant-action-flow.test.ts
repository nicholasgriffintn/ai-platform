import { describe, expect, it, vi } from "vitest";
import type { AssistantRecipe, RecipeInstallation } from "@assistant/schemas";

import { launchAssistantAction } from "../assistant-action-flow";
import {
	loadAssistantActionRequestOptions,
	parseAssistantActionLaunchState,
} from "../assistant-action-launch";
import { buildAssistantActionCatalog } from "../assistant-actions";

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

describe("assistant action flow", () => {
	it("discovers an uninstalled recipe and launches setup chat through one flow", async () => {
		const catalog = buildAssistantActionCatalog({
			recipes: [morningBriefingRecipe],
			installations: [],
		});
		const setupVerb = catalog.verbs.find((verb) => verb.command === "setup");
		const recipeItem = catalog.items.find((item) => item.id === "recipe:morning-briefing");
		if (!setupVerb || !recipeItem) {
			throw new Error("Expected setup verb and recipe item");
		}
		const installRecipe = vi.fn().mockResolvedValue({
			recipe: morningBriefingRecipe,
			conversationStarter: "Set up the Morning Briefing recipe.",
			messageUrl: "/?query=Set+up+the+Morning+Briefing+recipe.",
			checklist: [],
			connections: [],
			readyToRun: true,
			enabledTools: ["use_recipe_connector", "configure_recipe"],
			allowedConnectorProviders: ["gmail"],
			allowedConnectorOperations: {
				gmail: ["search_messages"],
			},
			installation: morningBriefingInstallation,
		});

		const result = await launchAssistantAction(
			{
				delivery: "conversation",
				input: "",
				item: recipeItem,
				selectedTools: [],
				verb: setupVerb,
			},
			{
				installRecipe,
				invokeRecipe: vi.fn(),
				startConnector: vi.fn(),
			},
		);

		expect(installRecipe).toHaveBeenCalledWith("morning-briefing");
		expect(result).toMatchObject({
			kind: "conversation",
			selectedTools: ["use_recipe_connector", "configure_recipe"],
		});
		if (result.kind !== "conversation") {
			throw new Error("Expected conversation launch");
		}

		const state = parseAssistantActionLaunchState(result.url.split("?")[1] ?? "");
		expect(state.query).toBe("Set up the Morning Briefing recipe.");
		expect(state.autoSubmit).toBe(true);
		expect(state.enabledTools).toEqual(["use_recipe_connector", "configure_recipe"]);
		expect(loadAssistantActionRequestOptions(state)).toEqual({
			recipe: {
				id: "morning-briefing",
				installationId: "installation-1",
				channel: "web",
				allowedConnectorProviders: ["gmail"],
				allowedConnectorOperations: {
					gmail: ["search_messages"],
				},
				configuration: {},
			},
		});
	});

	it("discovers an OAuth connector and starts setup through the same flow", async () => {
		const catalog = buildAssistantActionCatalog({
			connectors: [
				{
					id: "gmail",
					name: "Gmail",
					description: "Search messages and create drafts.",
					authType: "oauth2",
					status: "unconfigured",
					scopes: ["gmail.readonly"],
					operations: ["search_messages"],
				},
			],
		});
		const connectVerb = catalog.verbs.find((verb) => verb.command === "connect");
		const connectorItem = catalog.items.find((item) => item.id === "connector:gmail");
		if (!connectVerb || !connectorItem) {
			throw new Error("Expected connect verb and connector item");
		}
		const startConnector = vi.fn().mockResolvedValue({
			provider: "gmail",
			authorizationUrl: "https://accounts.google.com/oauth",
		});

		await expect(
			launchAssistantAction(
				{
					connectorReturnTo: "/apps/recipes",
					delivery: "conversation",
					input: "",
					item: connectorItem,
					selectedTools: [],
					verb: connectVerb,
				},
				{
					installRecipe: vi.fn(),
					invokeRecipe: vi.fn(),
					startConnector,
				},
			),
		).resolves.toEqual({
			kind: "external",
			input: "",
			url: "https://accounts.google.com/oauth",
		});
		expect(startConnector).toHaveBeenCalledWith("gmail", "/apps/recipes");
	});

	it("discovers an installed recipe and invokes it through the same flow", async () => {
		const catalog = buildAssistantActionCatalog({
			recipes: [morningBriefingRecipe],
			installations: [morningBriefingInstallation],
		});
		const runVerb = catalog.verbs.find((verb) => verb.command === "run");
		const recipeItem = catalog.items.find((item) => item.id === "installed_recipe:installation-1");
		if (!runVerb || !recipeItem) {
			throw new Error("Expected run verb and installed recipe item");
		}
		const invokeRecipe = vi.fn().mockResolvedValue({
			recipeId: "morning-briefing",
			installationId: "installation-1",
			channel: "web",
			status: "ready",
			conversationStarter: "Run the Morning Briefing recipe.",
			messageUrl: "/?query=Run+the+Morning+Briefing+recipe.",
			missingConnections: [],
			enabledTools: ["use_recipe_connector"],
			allowedConnectorProviders: ["gmail"],
			allowedConnectorOperations: {
				gmail: ["search_messages"],
			},
			configuration: {},
		});

		await expect(
			launchAssistantAction(
				{
					delivery: "submit",
					input: "@Morning Briefing for today",
					item: recipeItem,
					selectedTools: [],
					verb: runVerb,
				},
				{
					installRecipe: vi.fn(),
					invokeRecipe,
					startConnector: vi.fn(),
				},
			),
		).resolves.toEqual({
			kind: "submit",
			input: "@Morning Briefing for today",
			requestOptions: {
				recipe: {
					id: "morning-briefing",
					installationId: "installation-1",
					channel: "web",
					allowedConnectorProviders: ["gmail"],
					allowedConnectorOperations: {
						gmail: ["search_messages"],
					},
					configuration: {},
				},
			},
			selectedTools: ["use_recipe_connector"],
		});
		expect(invokeRecipe).toHaveBeenCalledWith("morning-briefing", "@Morning Briefing for today");
	});

	it("routes schedule recipe actions to the recipe scheduler instead of running the recipe", async () => {
		const catalog = buildAssistantActionCatalog({
			recipes: [morningBriefingRecipe],
			installations: [morningBriefingInstallation],
		});
		const scheduleVerb = catalog.verbs.find((verb) => verb.command === "schedule");
		const recipeItem = catalog.items.find((item) => item.id === "installed_recipe:installation-1");
		if (!scheduleVerb || !recipeItem) {
			throw new Error("Expected schedule verb and installed recipe item");
		}
		const installRecipe = vi.fn();
		const invokeRecipe = vi.fn();

		await expect(
			launchAssistantAction(
				{
					delivery: "submit",
					input: "@Morning Briefing",
					item: recipeItem,
					selectedTools: [],
					verb: scheduleVerb,
				},
				{
					installRecipe,
					invokeRecipe,
					startConnector: vi.fn(),
				},
			),
		).resolves.toEqual({
			kind: "navigation",
			input: "@Morning Briefing",
			path: "/apps/recipes?action=schedule&recipe=morning-briefing",
		});
		expect(installRecipe).not.toHaveBeenCalled();
		expect(invokeRecipe).not.toHaveBeenCalled();
	});
});
