import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	recipeInstallationUpdateRequestSchema,
	type RecipeConnectorManifest,
	type RecipeConnectorsResponse,
} from "@assistant/schemas";
import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { RepositoryManager, TemplateRepository } from "~/repositories";
import { TaskRepository } from "~/repositories/TaskRepository";
import type { IEnv, IUser } from "~/types";
import { configuredComposioToolkits } from "~/lib/providers/capabilities/connectors/composio/configured-toolkit-manifest";

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
import { assistantRecipes, getRecipeCatalogValidationIssues } from "../catalog";
import { trigger_recipe } from "~/services/functions/recipes/trigger_recipe";

type ConnectorFixture = Omit<
	RecipeConnectorManifest,
	"categories" | "toolCount" | "readToolCount" | "writeToolCount"
> & { operations: string[] };

function connectorFixture(connector: ConnectorFixture): RecipeConnectorManifest {
	const { operations, ...manifest } = connector;
	return {
		...manifest,
		categories: [],
		toolCount: operations.length,
		readToolCount: operations.length,
		writeToolCount: 0,
	};
}

const connectedConnectors: RecipeConnectorsResponse = {
	connectors: (
		[
			{
				id: "cloudflare",
				name: "Cloudflare",
				description: "Cloudflare",
				authType: "api_key",
				status: "connected",
				setupUrl: "/profile?tab=providers&type=connector&connector=cloudflare",
				credentialLabel: "API token",
				scopes: ["Account:read", "Zone:read", "Workers Scripts:read"],
				operations: [
					"list_accounts",
					"list_zones",
					"list_workers",
					"list_worker_deployments",
					"get_worker_deployment",
				],
			},
			{
				id: "github",
				name: "GitHub",
				description: "GitHub App",
				authType: "composio",
				status: "connected",
				setupUrl: "/profile?tab=sandbox",
				scopes: ["GitHub App installation"],
				operations: [],
			},
			{
				id: "devin",
				name: "Devin",
				description: "Devin",
				authType: "api_key",
				status: "connected",
				setupUrl: "/profile?tab=providers&type=connector&connector=devin",
				credentialLabel: "Service user API key",
				scopes: ["sessions:read", "sessions:write"],
				operations: [
					"list_sessions",
					"get_session",
					"create_session",
					"list_messages",
					"send_message",
				],
			},
			{
				id: "linear",
				name: "Linear",
				description: "Linear workspace",
				authType: "composio",
				status: "disconnected",
				setupUrl: "/profile?tab=providers&type=connector&connector=linear",
				authorizationUrl: "https://linear.app/oauth/authorize",
				scopes: ["read", "write"],
				operations: ["LINEAR_SEARCH_ISSUES", "LINEAR_CREATE_LINEAR_ISSUE"],
			},
			{
				id: "gmail",
				name: "Gmail",
				description: "Gmail",
				authType: "composio",
				status: "connected",
				setupUrl: "/profile?tab=providers&type=connector&connector=gmail",
				scopes: ["gmail"],
				operations: ["GMAIL_FETCH_EMAILS", "GMAIL_CREATE_EMAIL_DRAFT"],
			},
			{
				id: "googlecalendar",
				name: "Google Calendar",
				description: "Calendar",
				authType: "composio",
				status: "unconfigured",
				setupUrl: "/profile?tab=providers&type=connector&connector=googlecalendar",
				scopes: ["calendar"],
				operations: ["GOOGLECALENDAR_EVENTS_LIST", "GOOGLECALENDAR_CREATE_EVENT"],
			},
			{
				id: "notion",
				name: "Notion",
				description: "Notion",
				authType: "composio",
				status: "connected",
				setupUrl: "/profile?tab=providers&type=connector&connector=notion",
				scopes: [],
				operations: [
					"NOTION_SEARCH_NOTION_PAGE",
					"NOTION_RETRIEVE_PAGE",
					"NOTION_CREATE_NOTION_PAGE",
					"NOTION_ADD_MULTIPLE_PAGE_CONTENT",
				],
			},
			{
				id: "todoist",
				name: "Todoist",
				description: "Todoist",
				authType: "composio",
				status: "connected",
				setupUrl: "/profile?tab=providers&type=connector&connector=todoist",
				scopes: ["data:read_write"],
				operations: ["TODOIST_GET_ALL_TASKS", "TODOIST_CREATE_TASK", "TODOIST_CLOSE_TASK_V1"],
			},
			{
				id: "asana",
				name: "Asana",
				description: "Asana",
				authType: "composio",
				status: "connected",
				setupUrl: "/profile?tab=providers&type=connector&connector=asana",
				scopes: ["tasks:read", "tasks:write", "projects:read"],
				operations: [
					"ASANA_GET_MULTIPLE_PROJECTS",
					"ASANA_GET_MULTIPLE_TASKS",
					"ASANA_CREATE_A_TASK",
				],
			},
			{
				id: "posthog",
				name: "PostHog",
				description: "PostHog",
				authType: "composio",
				status: "connected",
				setupUrl: "/profile?tab=providers&type=connector&connector=posthog",
				scopes: ["project:read", "query:read"],
				operations: ["POSTHOG_LIST_ORGANIZATION_PROJECTS", "POSTHOG_CREATE_QUERY_IN_PROJECT_BY_ID"],
			},
			{
				id: "netlify",
				name: "Netlify",
				description: "Netlify",
				authType: "composio",
				status: "connected",
				setupUrl: "/profile?tab=providers&type=connector&connector=netlify",
				credentialLabel: "Personal access token",
				scopes: ["sites:read", "deploys:read"],
				operations: ["list_sites", "list_deploys", "get_deploy"],
			},
			{
				id: "webflow",
				name: "Webflow",
				description: "Webflow",
				authType: "api_key",
				status: "connected",
				setupUrl: "/profile?tab=providers&type=connector&connector=webflow",
				scopes: ["sites:read", "cms:read"],
				operations: [
					"WEBFLOW_LIST_WEBFLOW_SITES",
					"WEBFLOW_LIST_COLLECTIONS",
					"WEBFLOW_LIST_COLLECTION_ITEMS",
				],
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
		] satisfies ConnectorFixture[]
	).map(connectorFixture),
};

function withConnectorStatus(
	providerId: string,
	status: RecipeConnectorsResponse["connectors"][number]["status"],
): RecipeConnectorsResponse {
	return {
		connectors: connectedConnectors.connectors.map((connector) =>
			connector.id === providerId ? { ...connector, status } : connector,
		),
	};
}

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
		created_by_user_id: number;
		workspace_id: string | null;
		kind: "project" | "recipe" | "capability";
		capability_id: string | null;
		name: string;
		description: string;
		configuration: string;
		status: "active" | "paused" | "archived";
		created_at: string;
		updated_at: string;
	}> = [];

	const templateRepository: TemplateRepository = Object.assign(
		Object.create(TemplateRepository.prototype),
		{
			getPersonalTemplate: vi.fn(
				async (userId: number, kind: "project" | "recipe" | "capability", capabilityId: string) =>
					storedRecords.find(
						(record) =>
							record.created_by_user_id === userId &&
							record.workspace_id === null &&
							record.kind === kind &&
							record.capability_id === capabilityId,
					) ?? null,
			),
			createTemplate: vi.fn(
				async (input: {
					createdByUserId: number;
					workspaceId?: string | null;
					kind: "project" | "recipe" | "capability";
					capabilityId?: string | null;
					name: string;
					description?: string;
					configuration?: unknown;
					status?: "active" | "paused" | "archived";
				}) => {
					const record = {
						id: `record-${storedRecords.length + 1}`,
						created_by_user_id: input.createdByUserId,
						workspace_id: input.workspaceId ?? null,
						kind: input.kind,
						capability_id: input.capabilityId ?? null,
						name: input.name,
						description: input.description ?? "",
						configuration: JSON.stringify(input.configuration ?? {}),
						status: input.status ?? "active",
						created_at: "2026-06-07T10:00:00.000Z",
						updated_at: "2026-06-07T10:00:00.000Z",
					};
					storedRecords.push(record);
					return record;
				},
			),
			getTemplateById: vi.fn(
				async (id: string) => storedRecords.find((record) => record.id === id) ?? null,
			),
			listPersonalTemplates: vi.fn(
				async (userId: number, kind?: "project" | "recipe" | "capability") =>
					storedRecords.filter(
						(record) =>
							record.created_by_user_id === userId &&
							record.workspace_id === null &&
							(kind === undefined || record.kind === kind),
					),
			),
			updateTemplate: vi.fn(
				async (
					id: string,
					updates: {
						name?: string;
						description?: string;
						configuration?: unknown;
						status?: "active" | "paused" | "archived";
					},
				) => {
					const record = storedRecords.find((item) => item.id === id);
					if (record) {
						if (updates.name !== undefined) record.name = updates.name;
						if (updates.description !== undefined) record.description = updates.description;
						if (updates.configuration !== undefined) {
							record.configuration = JSON.stringify(updates.configuration);
						}
						if (updates.status !== undefined) record.status = updates.status;
						record.updated_at = "2026-06-07T10:05:00.000Z";
					}
					return record ?? null;
				},
			),
			deleteTemplate: vi.fn(async (id: string) => {
				const index = storedRecords.findIndex((record) => record.id === id);
				if (index >= 0) {
					storedRecords.splice(index, 1);
				}
			}),
		},
	);
	const taskRepository: TaskRepository = Object.assign(Object.create(TaskRepository.prototype), {});

	vi.spyOn(context, "repositories", "get").mockReturnValue(repositories);
	vi.spyOn(repositories, "templates", "get").mockReturnValue(templateRepository);
	vi.spyOn(repositories, "tasks", "get").mockReturnValue(taskRepository);
	vi.spyOn(repositories, "recipeComposioTriggers", "get").mockReturnValue({
		listInstallationTriggers: vi.fn().mockResolvedValue([]),
	} as never);

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

		expect(recipe?.capability).toEqual(
			expect.objectContaining({
				id: "morning-briefing",
				kind: "recipe",
				name: "Morning Briefing",
				description: expect.any(String),
				availability: "available",
				launch: {
					method: "conversation",
					action: "recipe_chat",
				},
				executionMode: "workflow",
				authRequirement: "pro",
				savedState: {
					supported: true,
					kind: "installation",
				},
				tags: ["productivity", "automation"],
				requiredConnectors: [
					{ provider: "gmail", state: "unknown" },
					{ provider: "outlook", state: "unknown" },
					{ provider: "googlecalendar", state: "unknown" },
				],
				requiredModelCapabilities: [],
			}),
		);
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
				id: "googlecalendar",
				providerId: "googlecalendar",
				connectionStatus: "unconfigured",
			}),
		]);
	});

	it("derives allowed connector providers for direct integration recipes", async () => {
		const context = createTestServiceContext();
		const setup = await installAssistantRecipe("gmail", {
			context,
			userId: 42,
			channel: "web",
		});
		expect(setup).toMatchObject({
			allowedConnectorProviders: ["gmail"],
			allowedConnectorOperations: {
				gmail: ["GMAIL_FETCH_EMAILS", "GMAIL_CREATE_EMAIL_DRAFT"],
			},
			enabledTools: ["use_recipe_connector", "get_recipe", "configure_recipe"],
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
				gmail: ["GMAIL_FETCH_EMAILS", "GMAIL_CREATE_EMAIL_DRAFT"],
			},
			enabledTools: ["use_recipe_connector"],
		});
	});

	it("starts bad weather setup with weather access and a persistence tool", async () => {
		const context = createTestServiceContext();

		const setup = await installAssistantRecipe("bad-weather-alerts", {
			context,
			userId: 42,
			channel: "web",
		});

		expect(setup).toMatchObject({
			recipe: expect.objectContaining({
				id: "bad-weather-alerts",
			}),
			enabledTools: ["get_weather", "get_recipe", "configure_recipe"],
			installation: expect.objectContaining({
				recipeId: "bad-weather-alerts",
				status: "active",
			}),
		});
		expect(setup?.conversationStarter).toContain(
			"When I confirm setup changes or ask you to choose sensible defaults, use the available context and tools, then use configure_recipe to save recipe configuration and triggers before saying setup is complete.",
		);
		expect(setup?.conversationStarter).toContain(
			"Enabled tools for this conversation: get_weather, get_recipe, configure_recipe.",
		);
	});

	it("includes Outlook calendar reads in morning briefing connector scope", async () => {
		const context = createTestServiceContext();
		listRecipeConnectorsMock.mockResolvedValue(withConnectorStatus("googlecalendar", "connected"));

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
				gmail: ["GMAIL_FETCH_EMAILS"],
				outlook: ["OUTLOOK_SEARCH_MESSAGES", "OUTLOOK_GET_CALENDAR_VIEW"],
				googlecalendar: ["GOOGLECALENDAR_EVENTS_LIST"],
			},
		});
	});

	it("scopes flight calendar recipe connector operations to mail reads and calendar creates", async () => {
		const context = createTestServiceContext();
		listRecipeConnectorsMock.mockResolvedValue(withConnectorStatus("googlecalendar", "connected"));

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
			allowedConnectorProviders: ["gmail", "outlook", "googlecalendar"],
			allowedConnectorOperations: {
				gmail: ["GMAIL_FETCH_EMAILS"],
				outlook: ["OUTLOOK_SEARCH_MESSAGES", "OUTLOOK_CALENDAR_CREATE_EVENT"],
				googlecalendar: ["GOOGLECALENDAR_CREATE_EVENT"],
			},
			enabledTools: ["use_recipe_connector"],
			configuration: {
				calendarTarget: "Travel calendar",
				travelWindow: "Next 90 days",
			},
		});
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
				asana: ["ASANA_GET_MULTIPLE_PROJECTS", "ASANA_GET_MULTIPLE_TASKS", "ASANA_CREATE_A_TASK"],
			},
			enabledTools: ["use_recipe_connector"],
			configuration: {
				workspaceId: "workspace-1",
				projectIds: ["project-1"],
			},
		});
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
				posthog: ["POSTHOG_LIST_ORGANIZATION_PROJECTS", "POSTHOG_CREATE_QUERY_IN_PROJECT_BY_ID"],
			},
			enabledTools: ["use_recipe_connector"],
			configuration: {
				region: "eu",
				organizationId: "org-1",
				projectId: "123",
			},
		});
	});

	it("derives Netlify read-only connector operations for the Netlify integration recipe", async () => {
		const context = createTestServiceContext();
		await installAssistantRecipe("netlify", {
			context,
			userId: 42,
			channel: "web",
			configuration: {
				siteId: "polychat.netlify.app",
				defaultBranch: "main",
				defaultDeployFocus: "Failed production deploys",
			},
		});

		const invocation = await invokeAssistantRecipe("netlify", {
			context,
			userId: 42,
			channel: "tool",
			requireInstalled: true,
		});

		expect(invocation).toMatchObject({
			recipeId: "netlify",
			status: "ready",
			allowedConnectorProviders: ["netlify"],
			allowedConnectorOperations: {
				netlify: ["list_sites", "list_deploys", "get_deploy"],
			},
			enabledTools: ["use_recipe_connector"],
			configuration: {
				siteId: "polychat.netlify.app",
				defaultBranch: "main",
				defaultDeployFocus: "Failed production deploys",
			},
		});
	});

	it("derives Devin connector operations for the Devin integration recipe", async () => {
		const context = createTestServiceContext();
		await installAssistantRecipe("devin", {
			context,
			userId: 42,
			channel: "web",
			configuration: {
				organizationId: "org-abc123def456",
				defaultRepos: ["nicholasgriffin/assistant"],
				defaultTags: ["polychat", "recipe"],
				playbookId: "playbook-123",
				maxAcuLimit: 3,
			},
		});

		const invocation = await invokeAssistantRecipe("devin", {
			context,
			userId: 42,
			channel: "tool",
			requireInstalled: true,
		});

		expect(invocation).toMatchObject({
			recipeId: "devin",
			status: "ready",
			allowedConnectorProviders: ["devin"],
			allowedConnectorOperations: {
				devin: ["list_sessions", "get_session", "create_session", "list_messages", "send_message"],
			},
			enabledTools: ["use_recipe_connector"],
			configuration: {
				organizationId: "org-abc123def456",
				defaultRepos: ["nicholasgriffin/assistant"],
				defaultTags: ["polychat", "recipe"],
				playbookId: "playbook-123",
				maxAcuLimit: 3,
			},
		});
	});

	it("derives Cloudflare read-only connector operations for the Cloudflare integration recipe", async () => {
		const context = createTestServiceContext();
		await installAssistantRecipe("cloudflare", {
			context,
			userId: 42,
			channel: "web",
			configuration: {
				accountId: "account_123",
				zoneName: "polychat.app",
				scriptName: "assistant-api",
			},
		});

		const invocation = await invokeAssistantRecipe("cloudflare", {
			context,
			userId: 42,
			channel: "tool",
			requireInstalled: true,
		});

		expect(invocation).toMatchObject({
			recipeId: "cloudflare",
			status: "ready",
			allowedConnectorProviders: ["cloudflare"],
			allowedConnectorOperations: {
				cloudflare: ["CLOUDFLARE_LIST_ACCOUNTS", "CLOUDFLARE_LIST_ZONES"],
			},
			enabledTools: ["use_recipe_connector"],
			configuration: {
				accountId: "account_123",
				zoneName: "polychat.app",
				scriptName: "assistant-api",
			},
		});
	});

	it("derives Webflow read-only connector operations for the Webflow integration recipe", async () => {
		const context = createTestServiceContext();
		await installAssistantRecipe("webflow", {
			context,
			userId: 42,
			channel: "web",
			configuration: {
				siteId: "site_123",
				collectionId: "collection_123",
				cmsLocaleId: "locale_123",
				defaultContentFocus: "Recently updated CMS items",
			},
		});

		const invocation = await invokeAssistantRecipe("webflow", {
			context,
			userId: 42,
			channel: "tool",
			requireInstalled: true,
		});

		expect(invocation).toMatchObject({
			recipeId: "webflow",
			status: "ready",
			allowedConnectorProviders: ["webflow"],
			allowedConnectorOperations: {
				webflow: [
					"WEBFLOW_LIST_WEBFLOW_SITES",
					"WEBFLOW_LIST_COLLECTIONS",
					"WEBFLOW_LIST_COLLECTION_ITEMS",
				],
			},
			enabledTools: ["use_recipe_connector"],
			configuration: {
				siteId: "site_123",
				collectionId: "collection_123",
				cmsLocaleId: "locale_123",
				defaultContentFocus: "Recently updated CMS items",
			},
		});
	});

	it("scopes developer standup to the configured GitHub and Linear tools", async () => {
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
			enabledTools: ["use_recipe_connector"],
			allowedConnectorProviders: ["github", "linear"],
			allowedConnectorOperations: {
				github: ["GITHUB_GET_A_REPOSITORY", "GITHUB_LIST_COMMITS", "GITHUB_LIST_PULL_REQUESTS"],
				linear: ["LINEAR_SEARCH_ISSUES"],
			},
		});
	});

	it("keeps catalogue connector operations supported and scheduled recipes read-only", () => {
		expect(getRecipeCatalogValidationIssues()).toEqual([]);
	});

	it("provides purpose-built recipes for every explicitly configured Composio toolkit", () => {
		for (const [provider, toolkit] of Object.entries(configuredComposioToolkits)) {
			const completeIntegration = assistantRecipes
				.flatMap((recipe) => recipe.integrations)
				.find(
					(integration) =>
						integration.providerId === provider &&
						integration.operationIds?.length === toolkit.operations.length,
				);
			expect(completeIntegration, provider).toBeDefined();
			expect(new Set(completeIntegration?.operationIds), provider).toEqual(
				new Set(toolkit.operations.map((operation) => operation.id)),
			);
		}
	});

	it("exposes Pashi discovery and ordered execution through its recipe", () => {
		expect(getRecipeById("pashi-generator-toolkit")).toMatchObject({
			id: "pashi-generator-toolkit",
			enabledTools: ["search_pashi_tools", "run_pashi_tools"],
			integrations: [],
			configurationFields: [
				expect.objectContaining({ key: "preferredToolTypes" }),
				expect.objectContaining({ key: "outputPreferences" }),
			],
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
		expect(setup?.conversationStarter).not.toContain("I am starting this setup");
		expect(setup?.conversationStarter).not.toContain("Saved recipe configuration:");
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
		expect(installations.installations[0]?.configuration).toEqual({
			location: "London",
			forecastTime: "07:30",
		});
	});

	it("keeps saved configuration on the installation without duplicating it in setup prompts", async () => {
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
		expect(setup?.conversationStarter).not.toContain("- location: London");
		expect(setup?.conversationStarter).not.toContain("- forecastTime: 07:30");
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
				providerId: "googlecalendar",
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
			enabledTools: ["use_recipe_connector"],
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
		const setup = await installAssistantRecipe("daily-weather", {
			context,
			userId: 42,
			channel: "web",
			triggers: [{ type: "manual", enabled: true }],
			configuration: {
				location: "London",
			},
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
			recipeId: "daily-weather",
			status: "paused",
			configuration: {
				location: "London",
			},
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

	it("pauses a configured scheduled recipe without clearing its configuration", async () => {
		const context = createTestServiceContext();
		const setup = await installAssistantRecipe("bad-weather-alerts", {
			context,
			userId: 42,
			channel: "web",
			triggers: [
				{ type: "manual", enabled: true },
				{
					type: "schedule",
					enabled: true,
					cronExpression: "0 9 * * *",
					prompt: "Check morning weather for London",
				},
			],
			configuration: {
				location: "London",
				alertThresholds: ["Heavy rain", "strong winds"],
				forecastTime: "09:00",
			},
		});

		const updated = await updateRecipeInstallation({
			context,
			userId: 42,
			installationId: setup?.installation?.id ?? "",
			update: recipeInstallationUpdateRequestSchema.parse({ status: "paused" }),
		});

		expect(updated).toMatchObject({
			status: "paused",
			configuration: {
				location: "London",
				alertThresholds: ["Heavy rain", "strong winds"],
				forecastTime: "09:00",
			},
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

			const updateTemplate = vi.mocked(context.repositories.templates.updateTemplate);
			expect(updateTemplate).toHaveBeenLastCalledWith(
				setup?.installation?.id,
				expect.objectContaining({
					configuration: expect.objectContaining({
						scheduleState: {
							"1": {
								cronExpression: "0 17 * * 5",
								enabled: true,
								activatedAt: "2026-06-07T10:01:00.000Z",
							},
						},
					}),
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

			expect(updateTemplate).toHaveBeenLastCalledWith(
				setup?.installation?.id,
				expect.objectContaining({
					configuration: expect.objectContaining({
						scheduleState: {
							"1": {
								cronExpression: "30 17 * * 5",
								enabled: true,
								activatedAt: "2026-06-07T10:20:00.000Z",
							},
						},
					}),
				}),
			);
		} finally {
			vi.useRealTimers();
		}
	});

	it("rejects scheduled triggers for recipes that do not support schedules", async () => {
		const context = createTestServiceContext();

		await expect(
			installAssistantRecipe("photo-nutrition-check", {
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
		).rejects.toThrow("Photo Nutrition Check does not support scheduled triggers");
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
		expect(reopened?.conversationStarter).not.toContain("- location: London");
		expect(reopened?.conversationStarter).not.toContain("- forecastTime: 09:05");
	});

	it("deletes installed recipes by user-owned installation id", async () => {
		const context = createTestServiceContext();
		const setup = await installAssistantRecipe("daily-weather", {
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
