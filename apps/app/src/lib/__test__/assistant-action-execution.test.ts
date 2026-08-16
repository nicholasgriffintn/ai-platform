import { describe, expect, it, vi } from "vitest";
import {
	buildAssistantActionCatalog,
	type AssistantRecipe,
	type RecipeInstallation,
	type SkillSummary,
} from "@ngriffin_uk/polychat-schemas";

import { executeAssistantAction } from "../assistant-action-execution";

const morningBriefingRecipe = {
	id: "morning-briefing",
	title: "Morning Briefing",
	summary: "Summarise your day",
	description: "Uses mail and calendar",
	kind: "automate",
	category: "Productivity",
	featured: true,
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

const artifactsSkill = {
	id: "artifacts",
	name: "Artifacts",
	description: "Create reusable deliverables.",
	category: "Output",
	tags: [],
	alwaysOn: false,
	requirement: { modelCapabilities: ["supportsToolCalls"], tools: [] },
} satisfies SkillSummary;

describe("assistant action execution", () => {
	it("executes selected items through their launch contract", async () => {
		await expect(
			executeAssistantAction(
				{
					input: "Use web fetch",
					item: {
						id: "custom:web-fetch",
						kind: "app",
						label: "Web fetch",
						launch: {
							kind: "tool_toggle",
							toolId: "web_fetch",
						},
					},
					selectedTools: [],
				},
				{
					installRecipe: vi.fn(),
					invokeRecipe: vi.fn(),
					startConnector: vi.fn(),
				},
			),
		).resolves.toEqual({
			kind: "submit",
			input: "Use web fetch",
			selectedTools: ["web_fetch"],
		});
	});

	it("keeps a selected skill on the existing tool-toggle launch seam", async () => {
		const catalog = buildAssistantActionCatalog({ skills: [artifactsSkill] });
		const item = catalog.items.find((catalogItem) => catalogItem.id === "skill:artifacts");
		if (!item) throw new Error("Expected artifacts skill item");

		await expect(
			executeAssistantAction(
				{ input: "@Artifacts build a dashboard", item, selectedTools: [] },
				{
					installRecipe: vi.fn(),
					invokeRecipe: vi.fn(),
					startConnector: vi.fn(),
				},
			),
		).resolves.toEqual({
			kind: "submit",
			input: "@Artifacts build a dashboard",
			selectedTools: ["load_skill"],
		});
	});

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
				options: {
					recipe: {
						id: "morning-briefing",
						installationId: "installation-1",
						channel: "web",
						allowedConnectorProviders: [],
						allowedConnectorOperations: {},
						configuration: {},
					},
				},
			},
			selectedTools: ["use_recipe_connector"],
		});
		expect(invokeRecipe).toHaveBeenCalledWith("morning-briefing", "@Morning Briefing today");
		expect(installRecipe).not.toHaveBeenCalled();
	});

	it("preserves the exact connected connector ID in chat without starting setup again", async () => {
		const catalog = buildAssistantActionCatalog({
			connectors: [
				{
					id: "googleslides",
					name: "Google Slides",
					description: "Create and edit presentations",
					authType: "composio",
					status: "connected",
					scopes: [],
					categories: [],
					toolCount: 1,
					readToolCount: 1,
					writeToolCount: 0,
				},
			],
		});
		const item = catalog.items.find((catalogItem) => catalogItem.id === "connector:googleslides");
		if (!item) {
			throw new Error("Expected connector item");
		}
		const startConnector = vi.fn();

		await expect(
			executeAssistantAction(
				{
					input: "@Google Slides make a presentation about Polychat",
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
			kind: "submit",
			input: "@Google Slides make a presentation about Polychat",
			requestOptions: {
				options: {
					connector: {
						provider: "googleslides",
					},
				},
			},
			selectedTools: ["use_recipe_connector"],
		});
		expect(startConnector).not.toHaveBeenCalled();
	});

	it("does not fabricate a removed global route when scheduling outside a project", async () => {
		await expect(
			executeAssistantAction(
				{
					input: "@Morning Briefing",
					item: {
						id: "installed_recipe:installation-1",
						kind: "installed_recipe",
						label: "Morning Briefing",
						launch: { kind: "schedule", recipeId: "morning-briefing" },
					},
				},
				{
					installRecipe: vi.fn(),
					invokeRecipe: vi.fn(),
					startConnector: vi.fn(),
				},
			),
		).resolves.toEqual({
			input: "@Morning Briefing",
			kind: "submit",
			notification: {
				message: "Schedule this recipe from a Work project's Capabilities page.",
				type: "error",
			},
		});
	});
});
