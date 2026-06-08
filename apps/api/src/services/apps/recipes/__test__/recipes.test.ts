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
	getRecipeById,
	deleteRecipeInstallation,
	installAssistantRecipe,
	invokeAssistantRecipe,
	listAssistantRecipes,
	listRecipeInstallations,
	resolveInstalledAssistantRecipe,
	updateRecipeInstallation,
} from "../index";
import { getRecipeCatalogValidationIssues } from "../catalog";
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
			operations: [],
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
			operations: ["search_issues", "create_issue"],
		},
		{
			id: "gmail",
			name: "Gmail",
			description: "Gmail",
			authType: "oauth2",
			status: "connected",
			setupUrl: "/profile?tab=providers&type=connector&connector=gmail",
			scopes: ["gmail"],
			operations: ["search_messages", "create_draft"],
		},
		{
			id: "calendar",
			name: "Google Calendar",
			description: "Calendar",
			authType: "oauth2",
			status: "unconfigured",
			setupUrl: "/profile?tab=providers&type=connector&connector=calendar",
			scopes: ["calendar"],
			operations: ["list_events", "create_event"],
		},
		{
			id: "notion",
			name: "Notion",
			description: "Notion",
			authType: "oauth2",
			status: "connected",
			setupUrl: "/profile?tab=providers&type=connector&connector=notion",
			scopes: [],
			operations: ["search", "retrieve_page", "create_page", "append_block_children"],
		},
		{
			id: "todoist",
			name: "Todoist",
			description: "Todoist",
			authType: "oauth2",
			status: "connected",
			setupUrl: "/profile?tab=providers&type=connector&connector=todoist",
			scopes: ["data:read_write"],
			operations: ["list_tasks", "create_task", "complete_task"],
		},
		{
			id: "asana",
			name: "Asana",
			description: "Asana",
			authType: "oauth2",
			status: "connected",
			setupUrl: "/profile?tab=providers&type=connector&connector=asana",
			scopes: ["tasks:read", "tasks:write", "projects:read"],
			operations: ["list_projects", "list_tasks", "create_task"],
		},
		{
			id: "sentry",
			name: "Sentry",
			description: "Sentry",
			authType: "oauth2",
			status: "connected",
			setupUrl: "/profile?tab=providers&type=connector&connector=sentry",
			scopes: ["org:read", "project:read", "event:read"],
			operations: ["list_organizations", "list_projects", "list_issues", "retrieve_issue"],
		},
		{
			id: "posthog",
			name: "PostHog",
			description: "PostHog",
			authType: "api_key",
			status: "connected",
			setupUrl: "/profile?tab=providers&type=connector&connector=posthog",
			credentialLabel: "Personal API key",
			scopes: ["project:read", "query:read"],
			operations: ["list_projects", "query"],
		},
		{
			id: "fitbit",
			name: "Fitbit",
			description: "Fitbit",
			authType: "oauth2",
			status: "connected",
			setupUrl: "/profile?tab=providers&type=connector&connector=fitbit",
			scopes: ["profile", "activity", "sleep", "heartrate"],
			operations: ["profile", "daily_activity", "sleep_logs", "heart_rate"],
		},
		{
			id: "withings",
			name: "Withings",
			description: "Withings",
			authType: "oauth2",
			status: "connected",
			setupUrl: "/profile?tab=providers&type=connector&connector=withings",
			scopes: ["user.info", "user.metrics", "user.activity"],
			operations: ["profile", "devices", "measurements", "activity", "sleep_summary"],
		},
		{
			id: "vercel",
			name: "Vercel",
			description: "Vercel",
			authType: "api_key",
			status: "connected",
			setupUrl: "/profile?tab=providers&type=connector&connector=vercel",
			credentialLabel: "Access token",
			scopes: ["projects:read", "deployments:read"],
			operations: ["list_projects", "list_deployments", "get_deployment_events"],
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
		expect(recipesById.get("todoist")).toMatchObject({
			title: "Todoist",
			kind: "integrate",
			category: "To-dos",
			enabledTools: ["use_recipe_connector"],
			integrations: [
				expect.objectContaining({
					providerId: "todoist",
					connectionStatus: "connected",
				}),
			],
		});
		expect(recipesById.get("asana")).toMatchObject({
			title: "Asana",
			kind: "integrate",
			category: "Productivity",
			enabledTools: ["use_recipe_connector"],
			integrations: [
				expect.objectContaining({
					providerId: "asana",
					connectionStatus: "connected",
				}),
			],
		});
		expect(recipesById.get("sentry")).toMatchObject({
			title: "Sentry",
			kind: "integrate",
			category: "Developer",
			enabledTools: ["use_recipe_connector"],
			integrations: [
				expect.objectContaining({
					providerId: "sentry",
					connectionStatus: "connected",
				}),
			],
		});
		expect(recipesById.get("posthog")).toMatchObject({
			title: "PostHog",
			kind: "integrate",
			category: "Developer",
			enabledTools: ["use_recipe_connector"],
			integrations: [
				expect.objectContaining({
					providerId: "posthog",
					connectionStatus: "connected",
				}),
			],
		});
		expect(recipesById.get("fitbit")).toMatchObject({
			title: "Fitbit",
			kind: "integrate",
			category: "Health",
			enabledTools: ["use_recipe_connector"],
			integrations: [
				expect.objectContaining({
					providerId: "fitbit",
					connectionStatus: "connected",
				}),
			],
		});
		expect(recipesById.get("withings")).toMatchObject({
			title: "Withings",
			kind: "integrate",
			category: "Health",
			enabledTools: ["use_recipe_connector"],
			integrations: [
				expect.objectContaining({
					providerId: "withings",
					connectionStatus: "connected",
				}),
			],
		});
		expect(recipesById.get("vercel")).toMatchObject({
			title: "Vercel",
			kind: "integrate",
			category: "Developer",
			enabledTools: ["use_recipe_connector"],
			integrations: [
				expect.objectContaining({
					providerId: "vercel",
					connectionStatus: "connected",
				}),
			],
		});
	});

	it("exposes Poke-style weather automation recipes backed by the built-in weather tool", async () => {
		const context = createTestServiceContext();

		const response = await listAssistantRecipes({ context, userId: 42 });
		const recipe = response.recipes.find((item) => item.id === "palo-alto-weather-comparison");

		expect(recipe).toMatchObject({
			title: "Palo Alto Weather Comparison",
			kind: "automate",
			category: "Community",
			enabledTools: ["get_weather"],
			integrations: [
				expect.objectContaining({
					providerId: "chat",
					requiresConnection: false,
					connectionStatus: "not_required",
				}),
			],
		});
		expect(recipe?.configurationFields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ key: "location", required: true }),
				expect.objectContaining({ key: "comparisonTone" }),
			]),
		);
	});

	it("exposes Poke-style travel calendar automation backed by mail and calendar connectors", async () => {
		const context = createTestServiceContext();

		const response = await listAssistantRecipes({ context, userId: 42 });
		const recipe = response.recipes.find((item) => item.id === "add-flights-to-calendar");

		expect(recipe).toMatchObject({
			title: "Add Flights to Calendar",
			kind: "automate",
			category: "Travel",
			enabledTools: ["use_recipe_connector"],
			integrations: [
				expect.objectContaining({
					providerId: "gmail",
					operationIds: ["search_messages"],
					connectionStatus: "connected",
				}),
				expect.objectContaining({
					providerId: "outlook",
					operationIds: ["search_messages", "create_calendar_event"],
					connectionStatus: "unknown",
				}),
				expect.objectContaining({
					providerId: "calendar",
					operationIds: ["create_event"],
					connectionStatus: "unconfigured",
				}),
			],
		});
		expect(recipe?.triggers).toEqual([
			expect.objectContaining({
				type: "message",
			}),
		]);
		expect(recipe?.configurationFields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ key: "calendarTarget", required: true }),
				expect.objectContaining({ key: "travelWindow" }),
			]),
		);
	});

	it("exposes additional Poke-style recipes backed by current Polychat tools", async () => {
		const context = createTestServiceContext();

		const response = await listAssistantRecipes({ context, userId: 42 });
		const recipesById = new Map(response.recipes.map((recipe) => [recipe.id, recipe]));

		expect(recipesById.get("did-you-know")).toMatchObject({
			title: "Did You Know?",
			kind: "automate",
			enabledTools: ["web_search"],
			integrations: [
				expect.objectContaining({
					providerId: "chat",
					requiresConnection: false,
					connectionStatus: "not_required",
				}),
			],
		});
		expect(recipesById.get("quick-qr-generator")).toMatchObject({
			title: "Quick QR Generator",
			kind: "integrate",
			enabledTools: ["create_qr_code"],
			integrations: [
				expect.objectContaining({
					providerId: "chat",
					requiresConnection: false,
					connectionStatus: "not_required",
				}),
			],
		});
		expect(recipesById.get("chonky-cat")).toMatchObject({
			title: "Chonky Cat",
			kind: "integrate",
			enabledTools: ["create_image"],
			integrations: [
				expect.objectContaining({
					providerId: "chat",
					requiresConnection: false,
					connectionStatus: "not_required",
				}),
			],
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
			allowedConnectorOperations: {
				gmail: ["search_messages", "create_draft"],
			},
			enabledTools: ["use_recipe_connector"],
		});
	});

	it("includes Outlook calendar reads in morning briefing connector scope", async () => {
		const context = createTestServiceContext();
		await installAssistantRecipe("morning-briefing", {
			context,
			userId: 42,
			channel: "web",
		});

		const invocation = await invokeAssistantRecipe("morning-briefing", {
			context,
			userId: 42,
			channel: "tool",
			requireInstalled: true,
		});

		expect(invocation).toMatchObject({
			recipeId: "morning-briefing",
			allowedConnectorOperations: {
				gmail: ["search_messages"],
				outlook: ["search_messages", "list_events"],
				calendar: ["list_events"],
			},
		});
	});

	it("scopes flight calendar recipe connector operations to mail reads and calendar creates", async () => {
		const context = createTestServiceContext();
		await installAssistantRecipe("add-flights-to-calendar", {
			context,
			userId: 42,
			channel: "web",
			configuration: {
				calendarTarget: "Travel calendar",
				travelWindow: "Next 90 days",
			},
		});

		const invocation = await invokeAssistantRecipe("add-flights-to-calendar", {
			context,
			userId: 42,
			channel: "tool",
			input: "Scan for upcoming flights",
			requireInstalled: true,
		});

		expect(invocation).toMatchObject({
			recipeId: "add-flights-to-calendar",
			allowedConnectorProviders: ["gmail", "outlook", "calendar"],
			allowedConnectorOperations: {
				gmail: ["search_messages"],
				outlook: ["search_messages", "create_calendar_event"],
				calendar: ["create_event"],
			},
			enabledTools: ["use_recipe_connector"],
			configuration: {
				calendarTarget: "Travel calendar",
				travelWindow: "Next 90 days",
			},
		});
		expect(invocation?.conversationStarter).toContain("- calendarTarget: Travel calendar");
		expect(invocation?.conversationStarter).toContain("- travelWindow: Next 90 days");
	});

	it("derives Asana connector operations for the Asana integration recipe", async () => {
		const context = createTestServiceContext();
		await installAssistantRecipe("asana", {
			context,
			userId: 42,
			channel: "web",
			configuration: {
				workspaceId: "workspace-1",
				projectIds: ["project-1"],
			},
		});

		const invocation = await invokeAssistantRecipe("asana", {
			context,
			userId: 42,
			channel: "tool",
			requireInstalled: true,
		});

		expect(invocation).toMatchObject({
			recipeId: "asana",
			status: "ready",
			allowedConnectorProviders: ["asana"],
			allowedConnectorOperations: {
				asana: ["list_projects", "list_tasks", "create_task"],
			},
			enabledTools: ["use_recipe_connector"],
			configuration: {
				workspaceId: "workspace-1",
				projectIds: ["project-1"],
			},
		});
		expect(invocation?.conversationStarter).toContain("- workspaceId: workspace-1");
		expect(invocation?.conversationStarter).toContain("- projectIds: project-1");
	});

	it("derives Sentry read-only connector operations for the Sentry integration recipe", async () => {
		const context = createTestServiceContext();
		await installAssistantRecipe("sentry", {
			context,
			userId: 42,
			channel: "web",
			configuration: {
				organizationSlug: "acme",
				projectIds: ["123"],
				issueQuery: "is:unresolved level:error",
			},
		});

		const invocation = await invokeAssistantRecipe("sentry", {
			context,
			userId: 42,
			channel: "tool",
			requireInstalled: true,
		});

		expect(invocation).toMatchObject({
			recipeId: "sentry",
			status: "ready",
			allowedConnectorProviders: ["sentry"],
			allowedConnectorOperations: {
				sentry: ["list_organizations", "list_projects", "list_issues", "retrieve_issue"],
			},
			enabledTools: ["use_recipe_connector"],
			configuration: {
				organizationSlug: "acme",
				projectIds: ["123"],
				issueQuery: "is:unresolved level:error",
			},
		});
		expect(invocation?.conversationStarter).toContain("- organizationSlug: acme");
		expect(invocation?.conversationStarter).toContain("- projectIds: 123");
		expect(invocation?.conversationStarter).toContain("- issueQuery: is:unresolved level:error");
	});

	it("derives PostHog read-only connector operations for the PostHog integration recipe", async () => {
		const context = createTestServiceContext();
		await installAssistantRecipe("posthog", {
			context,
			userId: 42,
			channel: "web",
			configuration: {
				region: "eu",
				organizationId: "org-1",
				projectId: "123",
			},
		});

		const invocation = await invokeAssistantRecipe("posthog", {
			context,
			userId: 42,
			channel: "tool",
			requireInstalled: true,
		});

		expect(invocation).toMatchObject({
			recipeId: "posthog",
			status: "ready",
			allowedConnectorProviders: ["posthog"],
			allowedConnectorOperations: {
				posthog: ["list_projects", "query"],
			},
			enabledTools: ["use_recipe_connector"],
			configuration: {
				region: "eu",
				organizationId: "org-1",
				projectId: "123",
			},
		});
		expect(invocation?.conversationStarter).toContain("- region: eu");
		expect(invocation?.conversationStarter).toContain("- organizationId: org-1");
		expect(invocation?.conversationStarter).toContain("- projectId: 123");
	});

	it("derives Vercel read-only connector operations for the Vercel integration recipe", async () => {
		const context = createTestServiceContext();
		await installAssistantRecipe("vercel", {
			context,
			userId: 42,
			channel: "web",
			configuration: {
				teamId: "team_123",
				teamSlug: "acme",
				projectId: "prj_123",
				defaultTarget: "production",
				defaultBranch: "main",
			},
		});

		const invocation = await invokeAssistantRecipe("vercel", {
			context,
			userId: 42,
			channel: "tool",
			requireInstalled: true,
		});

		expect(invocation).toMatchObject({
			recipeId: "vercel",
			status: "ready",
			allowedConnectorProviders: ["vercel"],
			allowedConnectorOperations: {
				vercel: ["list_projects", "list_deployments", "get_deployment_events"],
			},
			enabledTools: ["use_recipe_connector"],
			configuration: {
				teamId: "team_123",
				teamSlug: "acme",
				projectId: "prj_123",
				defaultTarget: "production",
				defaultBranch: "main",
			},
		});
		expect(invocation?.conversationStarter).toContain("- teamId: team_123");
		expect(invocation?.conversationStarter).toContain("- teamSlug: acme");
		expect(invocation?.conversationStarter).toContain("- projectId: prj_123");
		expect(invocation?.conversationStarter).toContain("- defaultTarget: production");
		expect(invocation?.conversationStarter).toContain("- defaultBranch: main");
	});

	it("derives Fitbit read-only connector operations for the Fitbit integration recipe", async () => {
		const context = createTestServiceContext();
		await installAssistantRecipe("fitbit", {
			context,
			userId: 42,
			channel: "web",
			configuration: {
				defaultDate: "today",
				metricFocus: ["activity", "sleep"],
				summaryStyle: "Concise morning check-in",
			},
		});

		const invocation = await invokeAssistantRecipe("fitbit", {
			context,
			userId: 42,
			channel: "tool",
			requireInstalled: true,
		});

		expect(invocation).toMatchObject({
			recipeId: "fitbit",
			status: "ready",
			allowedConnectorProviders: ["fitbit"],
			allowedConnectorOperations: {
				fitbit: ["profile", "daily_activity", "sleep_logs", "heart_rate"],
			},
			enabledTools: ["use_recipe_connector"],
			configuration: {
				defaultDate: "today",
				metricFocus: ["activity", "sleep"],
				summaryStyle: "Concise morning check-in",
			},
		});
		expect(invocation?.conversationStarter).toContain("- defaultDate: today");
		expect(invocation?.conversationStarter).toContain("- metricFocus: activity, sleep");
		expect(invocation?.conversationStarter).toContain("- summaryStyle: Concise morning check-in");
	});

	it("derives Withings read-only connector operations for the Withings integration recipe", async () => {
		const context = createTestServiceContext();
		await installAssistantRecipe("withings", {
			context,
			userId: 42,
			channel: "web",
			configuration: {
				startDate: "2026-06-01",
				endDate: "2026-06-08",
				metricFocus: ["weight", "sleep"],
				summaryStyle: "Weekly trend summary",
			},
		});

		const invocation = await invokeAssistantRecipe("withings", {
			context,
			userId: 42,
			channel: "tool",
			requireInstalled: true,
		});

		expect(invocation).toMatchObject({
			recipeId: "withings",
			status: "ready",
			allowedConnectorProviders: ["withings"],
			allowedConnectorOperations: {
				withings: ["profile", "devices", "measurements", "activity", "sleep_summary"],
			},
			enabledTools: ["use_recipe_connector"],
			configuration: {
				startDate: "2026-06-01",
				endDate: "2026-06-08",
				metricFocus: ["weight", "sleep"],
				summaryStyle: "Weekly trend summary",
			},
		});
		expect(invocation?.conversationStarter).toContain("- startDate: 2026-06-01");
		expect(invocation?.conversationStarter).toContain("- endDate: 2026-06-08");
		expect(invocation?.conversationStarter).toContain("- metricFocus: weight, sleep");
		expect(invocation?.conversationStarter).toContain("- summaryStyle: Weekly trend summary");
	});

	it("keeps GitHub App integrations out of the OAuth connector tool scope", async () => {
		const context = createTestServiceContext();
		await installAssistantRecipe("developer-standup", {
			context,
			userId: 42,
			channel: "web",
		});

		const invocation = await invokeAssistantRecipe("developer-standup", {
			context,
			userId: 42,
			channel: "tool",
			requireInstalled: true,
		});

		expect(invocation).toMatchObject({
			recipeId: "developer-standup",
			enabledTools: ["use_recipe_connector", "run_code_review"],
			allowedConnectorProviders: ["linear"],
			allowedConnectorOperations: {
				linear: ["search_issues"],
			},
		});
	});

	it("keeps catalogue connector operations supported and scheduled recipes read-only", () => {
		expect(getRecipeCatalogValidationIssues()).toEqual([]);
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

	it("uses queued task configuration overrides without mutating the saved recipe configuration", async () => {
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
		const invocation = await invokeAssistantRecipe("daily-weather", {
			context,
			userId: 42,
			channel: "scheduled",
			input: "Run the queued forecast",
			requireInstalled: true,
			configuration: {
				location: "Cambridge",
				forecastTime: "09:05",
				unexpected: "ignore me",
			},
		});
		const installations = await listRecipeInstallations({ context, userId: 42 });

		expect(invocation).toMatchObject({
			status: "ready",
			configuration: {
				location: "Cambridge",
				forecastTime: "09:05",
			},
		});
		expect(invocation?.configuration).not.toHaveProperty("unexpected");
		expect(invocation?.conversationStarter).toContain("- location: Cambridge");
		expect(invocation?.conversationStarter).toContain("- forecastTime: 09:05");
		expect(installations.installations[0]?.configuration).toEqual({
			location: "London",
			forecastTime: "07:30",
		});
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

	it("does not queue uninstalled recipe executions when installation is required", async () => {
		const context = createTestServiceContext();

		const invocation = await invokeAssistantRecipe("daily-weather", {
			context,
			userId: 42,
			channel: "web",
			input: "Run daily weather",
			queue: true,
			requireInstalled: true,
		});
		const installations = await listRecipeInstallations({ context, userId: 42 });

		expect(invocation).toMatchObject({
			status: "not_installed",
			recipeId: "daily-weather",
			configuration: {},
		});
		expect(invocation).not.toHaveProperty("installationId");
		expect(invocation).not.toHaveProperty("taskId");
		expect(installations.installations).toEqual([]);
	});

	it("does not advertise unsupported Linear issue updates in the catalogue", () => {
		const recipe = getRecipeById("linear-triage");

		expect(recipe?.actions.join(" ")).not.toMatch(/\bupdate\b/i);
		expect(recipe?.setupPrompt).toContain("only supports search and issue creation");
		expect(recipe?.setupPrompt).not.toMatch(/create or update/i);
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
		const setup = await installAssistantRecipe("daily-weather", {
			context,
			userId: 42,
			channel: "web",
			triggers: [
				{ type: "manual", enabled: true },
				{
					type: "schedule",
					enabled: true,
					cronExpression: "0 17 * * 5",
					prompt: "Prepare a weather forecast",
				},
			],
			configuration: {
				location: "London",
			},
		});

		const updated = await updateRecipeInstallation({
			context,
			userId: 42,
			installationId: setup?.installation?.id ?? "",
			update: {
				configuration: {
					location: "London",
					forecastTime: "17:00",
					mode: "ignored",
				},
			},
		});

		expect(updated).toMatchObject({
			id: setup?.installation?.id,
			configuration: {
				location: "London",
				forecastTime: "17:00",
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

	it("preserves schedule state for configuration updates and resets it when cron changes", async () => {
		vi.useFakeTimers();
		try {
			vi.setSystemTime(new Date("2026-06-07T10:01:00.000Z"));
			const context = createTestServiceContext();
			const setup = await installAssistantRecipe("daily-weather", {
				context,
				userId: 42,
				channel: "web",
				triggers: [
					{ type: "manual", enabled: true },
					{
						type: "schedule",
						enabled: true,
						cronExpression: "0 17 * * 5",
						prompt: "Prepare a weather forecast",
					},
				],
				configuration: {
					location: "London",
				},
			});

			vi.setSystemTime(new Date("2026-06-07T10:10:00.000Z"));
			await updateRecipeInstallation({
				context,
				userId: 42,
				installationId: setup?.installation?.id ?? "",
				update: {
					configuration: {
						location: "London",
					},
				},
			});

			const updateAppData = vi.mocked(context.repositories.appData.updateAppData);
			expect(updateAppData).toHaveBeenLastCalledWith(
				setup?.installation?.id,
				expect.objectContaining({
					scheduleState: {
						"1": {
							cronExpression: "0 17 * * 5",
							enabled: true,
							activatedAt: "2026-06-07T10:01:00.000Z",
						},
					},
				}),
			);

			vi.setSystemTime(new Date("2026-06-07T10:20:00.000Z"));
			await updateRecipeInstallation({
				context,
				userId: 42,
				installationId: setup?.installation?.id ?? "",
				update: {
					triggers: [
						{ type: "manual", enabled: true },
						{
							type: "schedule",
							enabled: true,
							cronExpression: "30 17 * * 5",
							prompt: "Prepare a weather forecast",
						},
					],
				},
			});

			expect(updateAppData).toHaveBeenLastCalledWith(
				setup?.installation?.id,
				expect.objectContaining({
					scheduleState: {
						"1": {
							cronExpression: "30 17 * * 5",
							enabled: true,
							activatedAt: "2026-06-07T10:20:00.000Z",
						},
					},
				}),
			);
		} finally {
			vi.useRealTimers();
		}
	});

	it("rejects scheduled triggers for recipes that do not support schedules", async () => {
		const context = createTestServiceContext();

		await expect(
			installAssistantRecipe("add-deadlines-to-calendar", {
				context,
				userId: 42,
				channel: "web",
				triggers: [
					{ type: "manual", enabled: true },
					{
						type: "schedule",
						enabled: true,
						cronExpression: "5 9 * * *",
					},
				],
			}),
		).rejects.toThrow("Add Deadlines to Calendar does not support scheduled triggers");
	});

	it("rejects unsupported cron expressions when installing a scheduled recipe", async () => {
		const context = createTestServiceContext();

		await expect(
			installAssistantRecipe("daily-weather", {
				context,
				userId: 42,
				channel: "web",
				triggers: [
					{ type: "manual", enabled: true },
					{
						type: "schedule",
						enabled: true,
						cronExpression: "60 9 * * *",
					},
				],
			}),
		).rejects.toThrow("Daily Weather schedule uses an unsupported cron expression");
	});

	it("rejects scheduled recipe installs when required configuration is missing", async () => {
		const context = createTestServiceContext();

		await expect(
			installAssistantRecipe("daily-weather", {
				context,
				userId: 42,
				channel: "web",
				triggers: [
					{ type: "manual", enabled: true },
					{
						type: "schedule",
						enabled: true,
						cronExpression: "5 9 * * *",
					},
				],
			}),
		).rejects.toThrow("Daily Weather scheduled triggers require recipe configuration: Location");
	});

	it("rejects schedule updates for installed recipes that do not support schedules", async () => {
		const context = createTestServiceContext();
		const setup = await installAssistantRecipe("follow-up-reminders", {
			context,
			userId: 42,
			channel: "web",
		});

		await expect(
			updateRecipeInstallation({
				context,
				userId: 42,
				installationId: setup?.installation?.id ?? "",
				update: {
					triggers: [
						{ type: "manual", enabled: true },
						{
							type: "schedule",
							enabled: true,
							cronExpression: "5 9 * * *",
						},
					],
				},
			}),
		).rejects.toThrow("Follow-up Reminders does not support scheduled triggers");
	});

	it("preserves saved triggers and configuration when reopening an installed recipe setup", async () => {
		const context = createTestServiceContext();
		const setup = await installAssistantRecipe("daily-weather", {
			context,
			userId: 42,
			channel: "web",
			triggers: [
				{ type: "manual", enabled: true },
				{
					type: "schedule",
					enabled: true,
					cronExpression: "5 9 * * *",
					prompt: "Send the morning weather",
					notificationChannel: "sms",
					notificationTarget: "+15551234567",
				},
			],
			configuration: {
				location: "London",
				forecastTime: "09:05",
			},
		});

		const reopened = await installAssistantRecipe("daily-weather", {
			context,
			userId: 42,
			channel: "web",
		});

		expect(reopened?.installation).toMatchObject({
			id: setup?.installation?.id,
			configuration: {
				location: "London",
				forecastTime: "09:05",
			},
			triggers: [
				expect.objectContaining({ type: "manual" }),
				expect.objectContaining({
					type: "schedule",
					cronExpression: "5 9 * * *",
					notificationChannel: "sms",
					notificationTarget: "+15551234567",
				}),
			],
		});
		expect(reopened?.conversationStarter).toContain("- location: London");
		expect(reopened?.conversationStarter).toContain("- forecastTime: 09:05");
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
