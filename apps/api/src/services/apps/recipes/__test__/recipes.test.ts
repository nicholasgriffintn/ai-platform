import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeConnectorsResponse } from "@assistant/schemas";
import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { AppDataRepository, RepositoryManager } from "~/repositories";
import { TaskRepository } from "~/repositories/TaskRepository";
import type { IEnv, IUser } from "~/types";

const { executeRecipeInvocationChatMock, listRecipeConnectorsMock } = vi.hoisted(() => ({
	executeRecipeInvocationChatMock: vi.fn(),
	listRecipeConnectorsMock: vi.fn(),
}));

vi.mock("../../connectors", () => ({
	listRecipeConnectors: listRecipeConnectorsMock,
}));

vi.mock("~/services/apps/recipes/execution", () => ({
	executeRecipeInvocationChat: executeRecipeInvocationChatMock,
}));

import {
	deleteRecipeInstallation,
	installAssistantRecipe,
	invokeAssistantRecipe,
	listAssistantRecipes,
	listRecipeInstallations,
	resolveInstalledAssistantRecipe,
	updateRecipeInstallation,
} from "../index";
import { trigger_recipe } from "~/services/functions/recipe_connectors";

const connectedConnectors: RecipeConnectorsResponse = {
	connectors: [
		{
			id: "github",
			name: "GitHub",
			description: "GitHub App",
			authType: "github_app",
			status: "connected",
			setupUrl: "/profile?tab=sandbox",
			scopes: ["GitHub App installation"],
		},
		{
			id: "linear",
			name: "Linear",
			description: "Linear workspace",
			authType: "oauth2",
			status: "disconnected",
			setupUrl: "/profile?tab=providers&type=connector&connector=linear",
			authorizationUrl: "https://linear.app/oauth/authorize",
			scopes: ["read", "write"],
		},
		{
			id: "gmail",
			name: "Gmail",
			description: "Gmail",
			authType: "oauth2",
			status: "connected",
			setupUrl: "/profile?tab=providers&type=connector&connector=gmail",
			scopes: ["gmail"],
		},
		{
			id: "calendar",
			name: "Google Calendar",
			description: "Calendar",
			authType: "oauth2",
			status: "unconfigured",
			setupUrl: "/profile?tab=providers&type=connector&connector=calendar",
			scopes: ["calendar"],
		},
		{
			id: "notion",
			name: "Notion",
			description: "Notion",
			authType: "oauth2",
			status: "connected",
			setupUrl: "/profile?tab=providers&type=connector&connector=notion",
			scopes: [],
		},
	],
};

const testUser: IUser = {
	id: 42,
	name: null,
	avatar_url: null,
	email: "user@example.com",
	github_username: null,
	company: null,
	site: null,
	location: null,
	bio: null,
	twitter_username: null,
	created_at: "2026-06-07T10:00:00.000Z",
	updated_at: "2026-06-07T10:00:00.000Z",
	setup_at: null,
	terms_accepted_at: null,
	plan_id: null,
};

function createTestServiceContext(): ServiceContext {
	const env: IEnv = Object.assign(Object.create(null), {
		DB: Object.create(null),
	});
	const context = createServiceContext({ env });
	const repositories = new RepositoryManager(env);
	const storedRecords: Array<{
		id: string;
		user_id: number;
		app_id: string;
		item_id: string;
		item_type: string;
		data: string;
		created_at: string;
		updated_at: string;
	}> = [];

	const appDataRepository: AppDataRepository = Object.assign(
		Object.create(AppDataRepository.prototype),
		{
			getAppDataByUserAppAndItem: vi.fn(
				async (userId: number, appId: string, itemId: string, itemType: string) =>
					storedRecords.filter(
						(record) =>
							record.user_id === userId &&
							record.app_id === appId &&
							record.item_id === itemId &&
							record.item_type === itemType,
					),
			),
			createAppDataWithItem: vi.fn(
				async (
					userId: number,
					appId: string,
					itemId: string,
					itemType: string,
					data: Record<string, unknown>,
				) => {
					const record = {
						id: `record-${storedRecords.length + 1}`,
						user_id: userId,
						app_id: appId,
						item_id: itemId,
						item_type: itemType,
						data: JSON.stringify(data),
						created_at: "2026-06-07T10:00:00.000Z",
						updated_at: "2026-06-07T10:00:00.000Z",
					};
					storedRecords.push(record);
					return record;
				},
			),
			getAppDataById: vi.fn(
				async (id: string) => storedRecords.find((record) => record.id === id) ?? null,
			),
			getAppDataByUserAndApp: vi.fn(async (userId: number, appId: string) =>
				storedRecords.filter((record) => record.user_id === userId && record.app_id === appId),
			),
			getAppDataByUserAndId: vi.fn(
				async (userId: number, id: string, itemType?: string) =>
					storedRecords.find(
						(record) =>
							record.user_id === userId &&
							record.id === id &&
							(itemType === undefined || record.item_type === itemType),
					) ?? null,
			),
			updateAppData: vi.fn(async (id: string, data: Record<string, unknown>) => {
				const record = storedRecords.find((item) => item.id === id);
				if (record) {
					record.data = JSON.stringify(data);
					record.updated_at = "2026-06-07T10:05:00.000Z";
				}
			}),
			deleteAppData: vi.fn(async (id: string) => {
				const index = storedRecords.findIndex((record) => record.id === id);
				if (index >= 0) {
					storedRecords.splice(index, 1);
				}
			}),
		},
	);
	const taskRepository: TaskRepository = Object.assign(Object.create(TaskRepository.prototype), {});

	vi.spyOn(context, "repositories", "get").mockReturnValue(repositories);
	vi.spyOn(repositories, "appData", "get").mockReturnValue(appDataRepository);
	vi.spyOn(repositories, "tasks", "get").mockReturnValue(taskRepository);

	return context;
}

describe("assistant recipes", () => {
	beforeEach(() => {
		listRecipeConnectorsMock.mockResolvedValue(connectedConnectors);
		executeRecipeInvocationChatMock.mockResolvedValue({
			conversationId: "recipe-conversation",
			response: {
				choices: [{ message: { content: "Recipe executed" } }],
			},
		});
	});

	it("enriches recipe integrations with connector connection status", async () => {
		const context = createTestServiceContext();

		const response = await listAssistantRecipes({ context, userId: 42 });
		const recipe = response.recipes.find((item) => item.id === "morning-briefing");

		expect(recipe?.integrations).toEqual([
			expect.objectContaining({
				id: "gmail",
				providerId: "gmail",
				connectionStatus: "connected",
				setupUrl: undefined,
			}),
			expect.objectContaining({
				id: "outlook",
				providerId: "outlook",
				connectionStatus: "unknown",
			}),
			expect.objectContaining({
				id: "calendar",
				providerId: "calendar",
				connectionStatus: "unconfigured",
			}),
		]);
	});

	it("exposes Poke-style first-party integration recipes backed by current connector operations", async () => {
		const context = createTestServiceContext();

		const response = await listAssistantRecipes({ context, userId: 42 });
		const recipesById = new Map(response.recipes.map((recipe) => [recipe.id, recipe]));

		expect(recipesById.get("gmail")).toMatchObject({
			title: "Gmail",
			kind: "integrate",
			category: "Email",
			enabledTools: ["use_recipe_connector"],
			integrations: [
				expect.objectContaining({
					providerId: "gmail",
					connectionStatus: "connected",
				}),
			],
		});
		expect(recipesById.get("outlook-mail")).toMatchObject({
			title: "Outlook Mail",
			kind: "integrate",
			category: "Email",
			enabledTools: ["use_recipe_connector"],
		});
		expect(recipesById.get("google-calendar")).toMatchObject({
			title: "Google Calendar",
			kind: "integrate",
			category: "Calendar",
			enabledTools: ["use_recipe_connector"],
			integrations: [
				expect.objectContaining({
					providerId: "calendar",
					connectionStatus: "unconfigured",
				}),
			],
		});
		expect(recipesById.get("outlook-calendar")).toMatchObject({
			title: "Outlook Calendar",
			kind: "integrate",
			category: "Calendar",
			enabledTools: ["use_recipe_connector"],
		});
	});

	it("derives allowed connector providers for direct integration recipes", async () => {
		const context = createTestServiceContext();
		await installAssistantRecipe("gmail", {
			context,
			userId: 42,
			channel: "web",
		});

		const invocation = await invokeAssistantRecipe("gmail", {
			context,
			userId: 42,
			channel: "tool",
			requireInstalled: true,
		});

		expect(invocation).toMatchObject({
			recipeId: "gmail",
			status: "ready",
			allowedConnectorProviders: ["gmail"],
			enabledTools: ["use_recipe_connector"],
		});
	});

	it("builds install setup with connector status and stores installation", async () => {
		const context = createTestServiceContext();

		const setup = await installAssistantRecipe("developer-standup", {
			context,
			userId: 42,
			channel: "web",
		});

		expect(setup).toMatchObject({
			readyToRun: false,
			connections: [
				expect.objectContaining({
					providerId: "github",
					status: "connected",
				}),
				expect.objectContaining({
					providerId: "linear",
					status: "missing",
				}),
			],
			checklist: expect.arrayContaining(["Connect or verify Linear"]),
			installation: expect.objectContaining({
				recipeId: "developer-standup",
				status: "active",
				configuration: {},
			}),
		});
		expect(setup?.conversationStarter).toContain("Connector status:");
		expect(setup?.conversationStarter).toContain("- GitHub: connected");
		expect(setup?.conversationStarter).toContain("- Linear: missing");
		expect(setup?.conversationStarter).toContain("Saved recipe configuration:");
		expect(setup?.conversationStarter).toContain("ask before");
	});

	it("stores recipe configuration and includes it in invocation context", async () => {
		const context = createTestServiceContext();

		const setup = await installAssistantRecipe("notion-action-log", {
			context,
			userId: 42,
			channel: "web",
			configuration: {
				notionTarget: "Product decisions database",
				instructions: "Capture owner, due date, and source conversation.",
				unexpected: "should not be stored",
			},
		});
		const invocation = await invokeAssistantRecipe("notion-action-log", {
			context,
			userId: 42,
			channel: "tool",
			input: "Log the launch decision",
			requireInstalled: true,
		});

		expect(setup?.installation).toMatchObject({
			recipeId: "notion-action-log",
			configuration: {
				notionTarget: "Product decisions database",
				instructions: "Capture owner, due date, and source conversation.",
			},
		});
		expect(invocation).toMatchObject({
			status: "ready",
			configuration: {
				notionTarget: "Product decisions database",
				instructions: "Capture owner, due date, and source conversation.",
			},
		});
		expect(setup?.installation.configuration).not.toHaveProperty("unexpected");
		expect(invocation?.conversationStarter).toContain("- notionTarget: Product decisions database");
		expect(invocation?.conversationStarter).toContain(
			"- instructions: Capture owner, due date, and source conversation.",
		);
	});

	it("keeps saved configuration in the chat starter when starting an installed recipe again", async () => {
		const context = createTestServiceContext();

		await installAssistantRecipe("daily-weather", {
			context,
			userId: 42,
			channel: "web",
			configuration: {
				location: "London",
				forecastTime: "07:30",
			},
		});
		const setup = await installAssistantRecipe("daily-weather", {
			context,
			userId: 42,
			channel: "web",
		});

		expect(setup?.installation?.configuration).toEqual({
			location: "London",
			forecastTime: "07:30",
		});
		expect(setup?.conversationStarter).toContain("- location: London");
		expect(setup?.conversationStarter).toContain("- forecastTime: 07:30");
		expect(setup?.messageUrl).toContain("location");
	});

	it("keeps public recipe lists usable when connection state is unavailable", async () => {
		const response = await listAssistantRecipes();
		const recipe = response.recipes.find((item) => item.id === "morning-briefing");

		expect(recipe?.integrations).toEqual([
			expect.objectContaining({
				providerId: "gmail",
				connectionStatus: "unknown",
			}),
			expect.objectContaining({
				providerId: "outlook",
				connectionStatus: "unknown",
			}),
			expect.objectContaining({
				providerId: "calendar",
				connectionStatus: "unknown",
			}),
		]);
	});

	it("enriches Notion recipes with connector connection status", async () => {
		const context = createTestServiceContext();

		const response = await listAssistantRecipes({ context, userId: 42 });
		const recipe = response.recipes.find((item) => item.id === "notion-workspace-assistant");

		expect(recipe).toMatchObject({
			id: "notion-workspace-assistant",
			enabledTools: ["use_recipe_connector"],
			integrations: [
				expect.objectContaining({
					providerId: "notion",
					connectionStatus: "connected",
					setupUrl: undefined,
				}),
			],
		});
	});

	it("returns a blocked invocation when required connectors are missing", async () => {
		const context = createTestServiceContext();

		const invocation = await invokeAssistantRecipe("developer-standup", {
			context,
			userId: 42,
			channel: "tool",
			input: "Prepare standup",
		});

		expect(invocation).toMatchObject({
			status: "blocked",
			missingConnections: [
				expect.objectContaining({
					providerId: "linear",
				}),
			],
			enabledTools: ["use_recipe_connector", "run_code_review"],
		});
	});

	it("does not create recipe installations for natural language tool triggers", async () => {
		const context = createTestServiceContext();

		const invocation = await invokeAssistantRecipe("morning-briefing", {
			context,
			userId: 42,
			channel: "tool",
			input: "Run my morning briefing",
			requireInstalled: true,
		});
		const installations = await listRecipeInstallations({ context, userId: 42 });

		expect(invocation).toMatchObject({
			status: "not_installed",
			recipeId: "morning-briefing",
			configuration: {},
		});
		expect(invocation).not.toHaveProperty("installationId");
		expect(installations.installations).toEqual([]);
	});

	it("resolves an installed active recipe from natural language", async () => {
		const context = createTestServiceContext();
		await installAssistantRecipe("bad-weather-alerts", {
			context,
			userId: 42,
			channel: "web",
		});

		const match = await resolveInstalledAssistantRecipe({
			context,
			userId: 42,
			query: "run my bad weather alert",
		});

		expect(match).toMatchObject({
			status: "matched",
			recipe: expect.objectContaining({
				id: "bad-weather-alerts",
			}),
			installation: expect.objectContaining({
				recipeId: "bad-weather-alerts",
			}),
		});
	});

	it("does not guess when natural language matches multiple installed recipes", async () => {
		const context = createTestServiceContext();
		await installAssistantRecipe("daily-weather", {
			context,
			userId: 42,
			channel: "web",
		});
		await installAssistantRecipe("bad-weather-alerts", {
			context,
			userId: 42,
			channel: "web",
		});

		const match = await resolveInstalledAssistantRecipe({
			context,
			userId: 42,
			query: "weather",
		});

		expect(match).toMatchObject({
			status: "ambiguous",
			candidates: [
				expect.objectContaining({ recipeId: "bad-weather-alerts" }),
				expect.objectContaining({ recipeId: "daily-weather" }),
			],
		});
	});

	it("ignores paused recipes when resolving natural language triggers", async () => {
		const context = createTestServiceContext();
		const setup = await installAssistantRecipe("daily-weather", {
			context,
			userId: 42,
			channel: "web",
		});
		await updateRecipeInstallation({
			context,
			userId: 42,
			installationId: setup?.installation.id ?? "",
			update: { status: "paused" },
		});

		const match = await resolveInstalledAssistantRecipe({
			context,
			userId: 42,
			query: "daily weather",
		});

		expect(match).toMatchObject({
			status: "not_found",
			candidates: [],
		});
	});

	it("triggers an installed recipe tool from natural language", async () => {
		const context = createTestServiceContext();
		await installAssistantRecipe("bad-weather-alerts", {
			context,
			userId: 42,
			channel: "web",
			configuration: {
				location: "London",
			},
		});

		const result = await trigger_recipe.execute(
			{
				query: "run my bad weather alert",
				input: "Check tomorrow morning",
			},
			{
				completionId: "completion-id",
				env: context.env,
				user: testUser,
				request: {
					env: context.env,
					context,
					user: testUser,
				},
			},
		);

		expect(result).toMatchObject({
			status: "success",
			name: "trigger_recipe",
			content: "Recipe executed",
			data: {
				recipeId: "bad-weather-alerts",
				status: "ready",
				executionConversationId: "recipe-conversation",
				configuration: {
					location: "London",
				},
			},
		});
	});

	it("updates installed recipe status and triggers", async () => {
		const context = createTestServiceContext();
		const setup = await installAssistantRecipe("morning-briefing", {
			context,
			userId: 42,
			channel: "web",
			triggers: [{ type: "manual", enabled: true }],
		});

		const updated = await updateRecipeInstallation({
			context,
			userId: 42,
			installationId: setup?.installation?.id ?? "",
			update: {
				status: "paused",
				triggers: [
					{ type: "manual", enabled: true },
					{
						type: "schedule",
						enabled: true,
						cronExpression: "0 9 * * *",
						prompt: "Run briefing",
					},
				],
			},
		});

		expect(updated).toMatchObject({
			id: setup?.installation?.id,
			recipeId: "morning-briefing",
			status: "paused",
			configuration: {},
			triggers: [
				expect.objectContaining({ type: "manual" }),
				expect.objectContaining({
					type: "schedule",
					cronExpression: "0 9 * * *",
					prompt: "Run briefing",
				}),
			],
		});
	});

	it("updates installed recipe configuration without dropping existing triggers", async () => {
		const context = createTestServiceContext();
		const setup = await installAssistantRecipe("notion-workspace-assistant", {
			context,
			userId: 42,
			channel: "web",
			triggers: [
				{ type: "manual", enabled: true },
				{
					type: "schedule",
					enabled: true,
					cronExpression: "0 17 * * 5",
					prompt: "Prepare a Notion workspace recap",
				},
			],
		});

		const updated = await updateRecipeInstallation({
			context,
			userId: 42,
			installationId: setup?.installation?.id ?? "",
			update: {
				configuration: {
					notionTarget: "Weekly review page",
					contentRules: "Append notes",
					mode: "ignored",
				},
			},
		});

		expect(updated).toMatchObject({
			id: setup?.installation?.id,
			configuration: {
				notionTarget: "Weekly review page",
				contentRules: "Append notes",
			},
			triggers: [
				expect.objectContaining({ type: "manual" }),
				expect.objectContaining({
					type: "schedule",
					cronExpression: "0 17 * * 5",
				}),
			],
		});
	});

	it("deletes installed recipes by user-owned installation id", async () => {
		const context = createTestServiceContext();
		const setup = await installAssistantRecipe("morning-briefing", {
			context,
			userId: 42,
			channel: "web",
		});

		const deleted = await deleteRecipeInstallation({
			context,
			userId: 42,
			installationId: setup?.installation?.id ?? "",
		});
		const installations = await listRecipeInstallations({ context, userId: 42 });

		expect(deleted).toBe(true);
		expect(installations.installations).toEqual([]);
	});
});
