import { describe, expect, it } from "vitest";
import type { AssistantRecipeInstallResponse, RecipeInvocationResponse } from "@assistant/schemas";

import {
	createRecipeChatUrl,
	loadRecipeChatRequestOptions,
	parseChatUrlState,
} from "./recipe-chat-context";

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

const noToolInvocation = {
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

describe("recipe chat URL contract", () => {
	it("carries the setup prompt, exact enabled tools, and recipe connector scope", () => {
		const url = createRecipeChatUrl(gmailSetup.messageUrl, gmailSetup);
		const state = parseChatUrlState(url.split("?")[1] ?? "");
		const requestOptions = loadRecipeChatRequestOptions(state.recipeContext);

		expect(state.query).toBe("Set up the Gmail recipe.");
		expect(state.hasEnabledTools).toBe(true);
		expect(state.enabledTools).toEqual(["use_recipe_connector", "get_recipe", "configure_recipe"]);
		expect(state.autoSubmit).toBe(true);
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

	it("preserves an intentionally empty tool set so stale tools are cleared", () => {
		const url = createRecipeChatUrl(noToolInvocation.messageUrl, noToolInvocation);
		const state = parseChatUrlState(url.split("?")[1] ?? "");

		expect(state.query).toBe("Run the planner recipe.");
		expect(state.hasEnabledTools).toBe(true);
		expect(state.enabledTools).toEqual([]);
		expect(state.autoSubmit).toBe(true);
	});
});
