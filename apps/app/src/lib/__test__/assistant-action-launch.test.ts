import { describe, expect, it } from "vitest";
import type { AssistantRecipeInstallResponse, RecipeInvocationResponse } from "@assistant/schemas";

import {
	createAppAssistantActionLaunch,
	createConnectorAssistantActionLaunch,
	createRecipeAssistantActionLaunch,
	createRecipeAssistantActionChatUrl,
	loadAssistantActionRequestOptions,
	parseAssistantActionLaunchState,
} from "../assistant-action-launch";

const gmailSetup = {
	recipe: {
		id: "gmail",
		title: "Gmail",
		summary: "Work with Gmail",
		description: "Search messages and create drafts.",
		kind: "integrate",
		category: "Email",
		featured: false,
		estimatedSetupMinutes: 3,
		integrations: [],
		triggers: [{ type: "message", label: "Message", description: "Run from chat" }],
		actions: ["Search Gmail", "Create drafts"],
		setupPrompt: "Set up the Gmail recipe.",
		enabledTools: ["use_recipe_connector"],
		configurationFields: [],
	},
	conversationStarter: "Set up the Gmail recipe.",
	messageUrl: "/?query=Set+up+the+Gmail+recipe.",
	checklist: [],
	connections: [],
	readyToRun: true,
	enabledTools: ["use_recipe_connector", "get_recipe", "configure_recipe"],
	allowedConnectorProviders: ["gmail"],
	allowedConnectorOperations: {
		gmail: ["search_messages", "create_draft"],
	},
	installation: {
		id: "installation-1",
		recipeId: "gmail",
		userId: 42,
		status: "active",
		triggers: [{ type: "manual", enabled: true }],
		configuration: { defaultSearch: "newer_than:7d" },
		createdAt: "2026-06-20T10:00:00.000Z",
		updatedAt: "2026-06-20T10:00:00.000Z",
	},
} satisfies AssistantRecipeInstallResponse;

const plannerInvocation = {
	recipeId: "plain-planner",
	installationId: "installation-2",
	channel: "web",
	status: "ready",
	conversationStarter: "Run the planner recipe.",
	messageUrl: "/?query=Run+the+planner+recipe.",
	missingConnections: [],
	enabledTools: [],
	allowedConnectorProviders: [],
	allowedConnectorOperations: {},
	configuration: {},
} satisfies RecipeInvocationResponse;

describe("assistant action launch URL contract", () => {
	it("creates a neutral action context for recipe setup launches", () => {
		const url = createRecipeAssistantActionChatUrl(gmailSetup);
		const state = parseAssistantActionLaunchState(url.split("?")[1] ?? "");
		const requestOptions = loadAssistantActionRequestOptions(state);

		expect(state.query).toBe("Set up the Gmail recipe.");
		expect(state.hasEnabledTools).toBe(true);
		expect(state.enabledTools).toEqual(["use_recipe_connector", "get_recipe", "configure_recipe"]);
		expect(state.autoSubmit).toBe(true);
		expect(url).toContain("assistant_action_context=");
		expect(url).not.toContain("recipe_context=");
		expect(requestOptions).toEqual({
			recipe: {
				id: "gmail",
				installationId: "installation-1",
				channel: "web",
				allowedConnectorProviders: ["gmail"],
				allowedConnectorOperations: {
					gmail: ["search_messages", "create_draft"],
				},
				configuration: { defaultSearch: "newer_than:7d" },
			},
		});
	});

	it("preserves intentionally empty tool sets for recipe invocation launches", () => {
		const url = createRecipeAssistantActionChatUrl(plannerInvocation);
		const state = parseAssistantActionLaunchState(url.split("?")[1] ?? "");

		expect(state.query).toBe("Run the planner recipe.");
		expect(state.hasEnabledTools).toBe(true);
		expect(state.enabledTools).toEqual([]);
		expect(state.autoSubmit).toBe(true);
	});

	it("creates a direct chat launch payload for recipe invocation from the composer", () => {
		expect(createRecipeAssistantActionLaunch(plannerInvocation)).toEqual({
			input: "Run the planner recipe.",
			enabledTools: [],
			requestOptions: {
				recipe: {
					id: "plain-planner",
					installationId: "installation-2",
					channel: "web",
					allowedConnectorProviders: [],
					allowedConnectorOperations: {},
					configuration: {},
				},
			},
		});
	});

	it("creates an app launch path for frontend and dynamic apps", () => {
		expect(
			createAppAssistantActionLaunch({
				appId: "articles",
				appKind: "frontend",
				href: "/apps/articles",
			}),
		).toEqual({ navigationPath: "/apps/articles" });

		expect(
			createAppAssistantActionLaunch({
				appId: "article-research",
				appKind: "dynamic",
			}),
		).toEqual({ navigationPath: "/apps?app=article-research" });
	});

	it("rejects app launch payloads without an app id", () => {
		expect(() => createAppAssistantActionLaunch({})).toThrow("This app cannot open");
	});

	it("creates connector launch payloads for API-key and OAuth connectors", () => {
		expect(
			createConnectorAssistantActionLaunch({
				provider: "posthog",
				authType: "api_key",
			}),
		).toEqual({
			navigationPath: "/profile?tab=providers&type=connector&connector=posthog",
		});

		expect(
			createConnectorAssistantActionLaunch({
				provider: "gmail",
				authType: "oauth2",
				authorizationUrl: "https://accounts.google.com/oauth",
			}),
		).toEqual({
			externalUrl: "https://accounts.google.com/oauth",
		});
	});

	it("keeps reading legacy recipe contexts during the URL migration", () => {
		const params = new URLSearchParams();
		params.set(
			"recipe_context",
			JSON.stringify({
				recipe: {
					id: "gmail",
					installationId: "installation-1",
					channel: "web",
					allowedConnectorProviders: ["gmail"],
					allowedConnectorOperations: { gmail: ["search_messages"] },
					configuration: { defaultSearch: "from:team" },
				},
			}),
		);

		const state = parseAssistantActionLaunchState(params.toString());

		expect(loadAssistantActionRequestOptions(state)).toEqual({
			recipe: {
				id: "gmail",
				installationId: "installation-1",
				channel: "web",
				allowedConnectorProviders: ["gmail"],
				allowedConnectorOperations: { gmail: ["search_messages"] },
				configuration: { defaultSearch: "from:team" },
			},
		});
	});
});
