import { describe, expect, it, vi } from "vitest";
import {
	buildAssistantActionCatalog,
	type AssistantRecipe,
	type RecipeInstallation,
} from "@assistant/schemas";

import { executeAssistantAction } from "../assistant-action-execution";

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

describe("assistant action execution", () => {
	it("runs installed recipe catalogue items without changing the visible prompt", async () => {
		const catalog = buildAssistantActionCatalog({
			recipes: [morningBriefingRecipe],
			installations: [morningBriefingInstallation],
		});
		const item = catalog.items.find(
			(catalogItem) => catalogItem.id === "installed_recipe:installation-1",
		);
		if (!item) {
			throw new Error("Expected installed recipe item");
		}
		const installRecipe = vi.fn();
		const invokeRecipe = vi.fn().mockResolvedValue({
			recipeId: "morning-briefing",
			installationId: "installation-1",
			channel: "web",
			status: "ready",
			conversationStarter: "Run the Morning Briefing recipe.",
			messageUrl: "/?query=Run+the+Morning+Briefing+recipe.",
			missingConnections: [],
			enabledTools: ["use_recipe_connector"],
			allowedConnectorProviders: [],
			allowedConnectorOperations: {},
			configuration: {},
		});

		await expect(
			executeAssistantAction(
				{
					input: "@Morning Briefing today",
					item,
					selectedTools: [],
				},
				{
					installRecipe,
					invokeRecipe,
					startConnector: vi.fn(),
				},
			),
		).resolves.toEqual({
			kind: "submit",
			input: "@Morning Briefing today",
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
			selectedTools: ["use_recipe_connector"],
		});
		expect(invokeRecipe).toHaveBeenCalledWith("morning-briefing", "@Morning Briefing today");
		expect(installRecipe).not.toHaveBeenCalled();
	});

	it("opens API-key connectors from catalogue items without starting OAuth setup", async () => {
		const catalog = buildAssistantActionCatalog({
			connectors: [
				{
					id: "posthog",
					name: "PostHog",
					description: "Query product analytics",
					authType: "api_key",
					status: "connected",
					scopes: ["project:read"],
					operations: ["query"],
				},
			],
		});
		const item = catalog.items.find((catalogItem) => catalogItem.id === "connector:posthog");
		if (!item) {
			throw new Error("Expected connector item");
		}
		const startConnector = vi.fn();

		await expect(
			executeAssistantAction(
				{
					input: "@PostHog",
					item,
					selectedTools: [],
				},
				{
					installRecipe: vi.fn(),
					invokeRecipe: vi.fn(),
					startConnector,
				},
			),
		).resolves.toEqual({
			kind: "navigation",
			input: "@PostHog",
			path: "/profile?tab=providers&type=connector&connector=posthog",
		});
		expect(startConnector).not.toHaveBeenCalled();
	});
});
