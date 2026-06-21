import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "~/lib/tools/ToolExecutionContext";
import type { IEnv, IRequest, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

const mocks = vi.hoisted(() => ({
	executeRecipeConnectorOperation: vi.fn(),
	resolveInstalledAssistantRecipe: vi.fn(),
	invokeAssistantRecipe: vi.fn(),
	updateRecipeInstallation: vi.fn(),
	getAssistantRecipe: vi.fn(),
	executeRecipeInvocationChat: vi.fn(),
	getRecipeConversationContext: vi.fn(),
}));

vi.mock("~/services/apps/connectors/operations", () => ({
	executeRecipeConnectorOperation: mocks.executeRecipeConnectorOperation,
}));

vi.mock("~/services/apps/recipes", () => ({
	resolveInstalledAssistantRecipe: mocks.resolveInstalledAssistantRecipe,
	invokeAssistantRecipe: mocks.invokeAssistantRecipe,
	updateRecipeInstallation: mocks.updateRecipeInstallation,
	getAssistantRecipe: mocks.getAssistantRecipe,
}));

vi.mock("~/services/apps/recipes/execution", () => ({
	executeRecipeInvocationChat: mocks.executeRecipeInvocationChat,
}));

vi.mock("~/services/apps/recipes/conversationContext", () => ({
	getRecipeConversationContext: mocks.getRecipeConversationContext,
}));

import { configure_recipe } from "../recipes/configure_recipe";
import { get_recipe } from "../recipes/get_recipe";
import { trigger_recipe } from "../recipes/trigger_recipe";
import { use_recipe_connector } from "../recipes/use_recipe_connector";

function createToolContext(
	params: {
		allowedConnectorProviders?: string[];
		allowedConnectorOperations?: Record<string, string[]>;
		recipeChannel?: "web" | "ios" | "sms" | "scheduled" | "tool";
		recipe?: {
			id: string;
			installationId?: string;
			configuration?: Record<string, unknown>;
		};
		userProviderSettings?: Record<string, unknown>[];
		sms?: {
			from?: string;
			to?: string;
		};
	} = {},
) {
	const env = {} as IEnv;
	const user = { id: 42 } as IUser;
	const serviceContext =
		params.userProviderSettings === undefined
			? {}
			: {
					repositories: {
						userSettings: {
							getUserProviderSettings: vi.fn().mockResolvedValue(params.userProviderSettings),
						},
					},
				};
	const request: IRequest = {
		env,
		app_url: "https://app.example.com",
		context: serviceContext as IRequest["context"],
		user,
		request: {
			completion_id: "completion-id",
			input: "use a connector",
			date: "2026-06-07T10:00:00.000Z",
			...(params.allowedConnectorProviders === undefined && !params.sms && !params.recipe
				? {}
				: {
						options: {
							...(params.sms
								? {
										source: "sms",
										sms: {
											enabled: true,
											from: params.sms.from,
											to: params.sms.to,
										},
									}
								: {}),
							...(params.allowedConnectorProviders === undefined
								? params.recipe
									? {
											recipe: {
												id: params.recipe.id,
												installationId: params.recipe.installationId,
												channel: params.recipeChannel,
												configuration: params.recipe.configuration,
											},
										}
									: {}
								: {
										recipe: {
											id: params.recipe?.id ?? "notion-action-log",
											installationId: params.recipe?.installationId,
											allowedConnectorProviders: params.allowedConnectorProviders,
											allowedConnectorOperations: params.allowedConnectorOperations,
											channel: params.recipeChannel,
											configuration: params.recipe?.configuration,
										},
									}),
							...(params.allowedConnectorProviders === undefined ? {} : {}),
						},
					}),
		},
	};

	return {
		completionId: "completion-id",
		env,
		user,
		request,
	} satisfies ToolExecutionContext;
}

describe("recipe connector tools", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.executeRecipeConnectorOperation.mockResolvedValue({ ok: true });
		mocks.getRecipeConversationContext.mockResolvedValue([]);
		mocks.getAssistantRecipe.mockResolvedValue({
			id: "bad-weather-alerts",
			title: "Bad Weather Alerts",
			enabledTools: ["get_weather"],
			triggers: [{ type: "schedule", label: "Morning alert" }],
			configurationFields: [
				{
					key: "location",
					label: "Location",
					type: "text",
					required: true,
				},
				{
					key: "alertThresholds",
					label: "Alert thresholds",
					type: "string_list",
				},
				{
					key: "forecastTime",
					label: "Forecast time",
					type: "text",
				},
			],
		});
	});

	it("rejects connector operations outside the active recipe scope", async () => {
		const result = await use_recipe_connector.execute(
			{
				provider: "gmail",
				operation: "search_messages",
				params: { query: "from:example" },
			},
			createToolContext({ allowedConnectorProviders: ["notion"] }),
		);

		expect(result).toEqual({
			status: "error",
			name: "use_recipe_connector",
			content: "The gmail connector is not enabled for this recipe.",
			data: {
				provider: "gmail",
				allowedConnectorProviders: ["notion"],
			},
		});
		expect(mocks.executeRecipeConnectorOperation).not.toHaveBeenCalled();
	});

	it("allows connector operations included in the active recipe scope", async () => {
		const result = await use_recipe_connector.execute(
			{
				provider: "notion",
				operation: "search",
				params: { query: "Action log" },
			},
			createToolContext({ allowedConnectorProviders: ["notion"] }),
		);

		expect(mocks.executeRecipeConnectorOperation).toHaveBeenCalledWith({
			context: {},
			userId: 42,
			request: {
				provider: "notion",
				operation: "search",
				params: { query: "Action log" },
			},
		});
		expect(result).toEqual({
			status: "success",
			name: "use_recipe_connector",
			content: "Connector operation completed",
			data: { ok: true },
		});
	});

	it("rejects connector operations outside the active recipe operation scope", async () => {
		const result = await use_recipe_connector.execute(
			{
				provider: "gmail",
				operation: "create_draft",
				params: { message: { to: "test@example.com" } },
			},
			createToolContext({
				allowedConnectorProviders: ["gmail"],
				allowedConnectorOperations: {
					gmail: ["search_messages"],
				},
			}),
		);

		expect(result).toEqual({
			status: "error",
			name: "use_recipe_connector",
			content: "The gmail connector operation is not enabled for this recipe.",
			data: {
				provider: "gmail",
				operation: "create_draft",
				allowedConnectorOperations: ["search_messages"],
			},
		});
		expect(mocks.executeRecipeConnectorOperation).not.toHaveBeenCalled();
	});

	it("returns reconnect-safe connector errors as tool results", async () => {
		mocks.executeRecipeConnectorOperation.mockRejectedValue(
			new AssistantError(
				"Connector token refresh failed. Reconnect this provider.",
				ErrorType.AUTHORISATION_ERROR,
				401,
			),
		);

		const result = await use_recipe_connector.execute(
			{
				provider: "gmail",
				operation: "search_messages",
				params: { query: "from:example" },
			},
			createToolContext({ allowedConnectorProviders: ["gmail"] }),
		);

		expect(result).toEqual({
			status: "error",
			name: "use_recipe_connector",
			content: "Connector token refresh failed. Reconnect this provider.",
			data: {
				provider: "gmail",
				operation: "search_messages",
				errorType: "AUTHORISATION_ERROR",
				statusCode: 401,
			},
		});
	});

	it("does not swallow unexpected connector runtime failures", async () => {
		mocks.executeRecipeConnectorOperation.mockRejectedValue(new Error("unexpected failure"));

		await expect(
			use_recipe_connector.execute(
				{
					provider: "gmail",
					operation: "search_messages",
					params: { query: "from:example" },
				},
				createToolContext({ allowedConnectorProviders: ["gmail"] }),
			),
		).rejects.toThrow("unexpected failure");
	});

	it("allows Todoist connector operations inside a Todoist recipe scope", async () => {
		const result = await use_recipe_connector.execute(
			{
				provider: "todoist",
				operation: "create_task",
				params: { content: "Follow up with finance", dueString: "tomorrow" },
			},
			createToolContext({ allowedConnectorProviders: ["todoist"] }),
		);

		expect(mocks.executeRecipeConnectorOperation).toHaveBeenCalledWith({
			context: {},
			userId: 42,
			request: {
				provider: "todoist",
				operation: "create_task",
				params: { content: "Follow up with finance", dueString: "tomorrow" },
			},
		});
		expect(result).toEqual({
			status: "success",
			name: "use_recipe_connector",
			content: "Connector operation completed",
			data: { ok: true },
		});
	});

	it("allows Asana connector operations inside an Asana recipe scope", async () => {
		const result = await use_recipe_connector.execute(
			{
				provider: "asana",
				operation: "create_task",
				params: { name: "Prepare launch plan", projectIds: ["project-1"] },
			},
			createToolContext({ allowedConnectorProviders: ["asana"] }),
		);

		expect(mocks.executeRecipeConnectorOperation).toHaveBeenCalledWith({
			context: {},
			userId: 42,
			request: {
				provider: "asana",
				operation: "create_task",
				params: { name: "Prepare launch plan", projectIds: ["project-1"] },
			},
		});
		expect(result).toEqual({
			status: "success",
			name: "use_recipe_connector",
			content: "Connector operation completed",
			data: { ok: true },
		});
	});

	it("allows Sentry read operations inside a Sentry recipe scope", async () => {
		const result = await use_recipe_connector.execute(
			{
				provider: "sentry",
				operation: "list_issues",
				params: { organizationSlug: "acme", query: "is:unresolved" },
			},
			createToolContext({
				allowedConnectorProviders: ["sentry"],
				allowedConnectorOperations: {
					sentry: ["list_organizations", "list_projects", "list_issues", "retrieve_issue"],
				},
			}),
		);

		expect(mocks.executeRecipeConnectorOperation).toHaveBeenCalledWith({
			context: {},
			userId: 42,
			request: {
				provider: "sentry",
				operation: "list_issues",
				params: { organizationSlug: "acme", query: "is:unresolved" },
			},
		});
		expect(result).toEqual({
			status: "success",
			name: "use_recipe_connector",
			content: "Connector operation completed",
			data: { ok: true },
		});
	});

	it("allows PostHog read operations inside a PostHog recipe scope", async () => {
		const result = await use_recipe_connector.execute(
			{
				provider: "posthog",
				operation: "query",
				params: {
					projectId: "123",
					query: "select event, count() from events group by event",
				},
			},
			createToolContext({
				allowedConnectorProviders: ["posthog"],
				allowedConnectorOperations: {
					posthog: ["list_projects", "query"],
				},
			}),
		);

		expect(mocks.executeRecipeConnectorOperation).toHaveBeenCalledWith({
			context: {},
			userId: 42,
			request: {
				provider: "posthog",
				operation: "query",
				params: {
					projectId: "123",
					query: "select event, count() from events group by event",
				},
			},
		});
		expect(result).toEqual({
			status: "success",
			name: "use_recipe_connector",
			content: "Connector operation completed",
			data: { ok: true },
		});
	});

	it("fills missing PostHog connector params from saved recipe configuration", async () => {
		const result = await use_recipe_connector.execute(
			{
				provider: "posthog",
				operation: "query",
				params: {
					query: "select event, count() from events group by event limit 10",
				},
			},
			createToolContext({
				allowedConnectorProviders: ["posthog"],
				allowedConnectorOperations: {
					posthog: ["list_projects", "query"],
				},
				recipe: {
					id: "posthog",
					configuration: {
						region: "us",
						projectId: "479272",
					},
				},
			}),
		);

		expect(mocks.executeRecipeConnectorOperation).toHaveBeenCalledWith({
			context: {},
			userId: 42,
			request: {
				provider: "posthog",
				operation: "query",
				params: {
					region: "us",
					projectId: "479272",
					query: "select event, count() from events group by event limit 10",
				},
			},
		});
		expect(result).toEqual({
			status: "success",
			name: "use_recipe_connector",
			content: "Connector operation completed",
			data: { ok: true },
		});
	});

	it("returns recoverable correction context for connector parameter errors", async () => {
		mocks.executeRecipeConnectorOperation.mockRejectedValue(
			new AssistantError("projectId is required", ErrorType.PARAMS_ERROR, 400),
		);

		const result = await use_recipe_connector.execute(
			{
				provider: "posthog",
				operation: "query",
				params: {
					query: {
						kind: "HogQLQuery",
						query: "SELECT event, count() FROM events GROUP BY event LIMIT 10",
					},
				},
			},
			createToolContext({
				allowedConnectorProviders: ["posthog"],
				allowedConnectorOperations: {
					posthog: ["list_projects", "query"],
				},
				recipe: {
					id: "posthog",
					configuration: {
						region: "us",
						projectId: "479272",
					},
				},
			}),
		);

		expect(result).toMatchObject({
			status: "error",
			name: "use_recipe_connector",
			content: expect.stringContaining("projectId is required"),
			data: {
				provider: "posthog",
				operation: "query",
				errorType: ErrorType.PARAMS_ERROR,
				statusCode: 400,
				recoverable: true,
				savedConfiguration: {
					region: "us",
					projectId: "479272",
				},
			},
		});
	});

	it("allows Vercel read operations inside a Vercel recipe scope", async () => {
		const result = await use_recipe_connector.execute(
			{
				provider: "vercel",
				operation: "list_deployments",
				params: {
					projectId: "prj_123",
					target: "production",
					state: "READY,ERROR",
				},
			},
			createToolContext({
				allowedConnectorProviders: ["vercel"],
				allowedConnectorOperations: {
					vercel: ["list_projects", "list_deployments", "get_deployment_events"],
				},
			}),
		);

		expect(mocks.executeRecipeConnectorOperation).toHaveBeenCalledWith({
			context: {},
			userId: 42,
			request: {
				provider: "vercel",
				operation: "list_deployments",
				params: {
					projectId: "prj_123",
					target: "production",
					state: "READY,ERROR",
				},
			},
		});
		expect(result).toEqual({
			status: "success",
			name: "use_recipe_connector",
			content: "Connector operation completed",
			data: { ok: true },
		});
	});

	it("allows Netlify read operations inside a Netlify recipe scope", async () => {
		const result = await use_recipe_connector.execute(
			{
				provider: "netlify",
				operation: "list_deploys",
				params: {
					siteId: "polychat.netlify.app",
				},
			},
			createToolContext({
				allowedConnectorProviders: ["netlify"],
				allowedConnectorOperations: {
					netlify: ["list_sites", "list_deploys", "get_deploy"],
				},
			}),
		);

		expect(mocks.executeRecipeConnectorOperation).toHaveBeenCalledWith({
			context: {},
			userId: 42,
			request: {
				provider: "netlify",
				operation: "list_deploys",
				params: {
					siteId: "polychat.netlify.app",
				},
			},
		});
		expect(result).toEqual({
			status: "success",
			name: "use_recipe_connector",
			content: "Connector operation completed",
			data: { ok: true },
		});
	});

	it("allows Cloudflare read operations inside a Cloudflare recipe scope", async () => {
		const result = await use_recipe_connector.execute(
			{
				provider: "cloudflare",
				operation: "list_worker_deployments",
				params: {
					accountId: "account_123",
					scriptName: "assistant-api",
				},
			},
			createToolContext({
				allowedConnectorProviders: ["cloudflare"],
				allowedConnectorOperations: {
					cloudflare: [
						"list_accounts",
						"list_zones",
						"list_workers",
						"list_worker_deployments",
						"get_worker_deployment",
					],
				},
			}),
		);

		expect(mocks.executeRecipeConnectorOperation).toHaveBeenCalledWith({
			context: {},
			userId: 42,
			request: {
				provider: "cloudflare",
				operation: "list_worker_deployments",
				params: {
					accountId: "account_123",
					scriptName: "assistant-api",
				},
			},
		});
		expect(result).toEqual({
			status: "success",
			name: "use_recipe_connector",
			content: "Connector operation completed",
			data: { ok: true },
		});
	});

	it("allows Supabase read operations inside a Supabase recipe scope", async () => {
		const result = await use_recipe_connector.execute(
			{
				provider: "supabase",
				operation: "list_functions",
				params: {
					projectRef: "abcdefghijklmnopqrst",
				},
			},
			createToolContext({
				allowedConnectorProviders: ["supabase"],
				allowedConnectorOperations: {
					supabase: ["list_organizations", "list_projects", "list_functions", "list_branches"],
				},
			}),
		);

		expect(mocks.executeRecipeConnectorOperation).toHaveBeenCalledWith({
			context: {},
			userId: 42,
			request: {
				provider: "supabase",
				operation: "list_functions",
				params: {
					projectRef: "abcdefghijklmnopqrst",
				},
			},
		});
		expect(result).toEqual({
			status: "success",
			name: "use_recipe_connector",
			content: "Connector operation completed",
			data: { ok: true },
		});
	});

	it("allows Webflow read operations inside a Webflow recipe scope", async () => {
		const result = await use_recipe_connector.execute(
			{
				provider: "webflow",
				operation: "list_items",
				params: {
					collectionId: "collection_123",
					limit: 25,
				},
			},
			createToolContext({
				allowedConnectorProviders: ["webflow"],
				allowedConnectorOperations: {
					webflow: ["list_sites", "list_collections", "list_items"],
				},
			}),
		);

		expect(mocks.executeRecipeConnectorOperation).toHaveBeenCalledWith({
			context: {},
			userId: 42,
			request: {
				provider: "webflow",
				operation: "list_items",
				params: {
					collectionId: "collection_123",
					limit: 25,
				},
			},
		});
		expect(result).toEqual({
			status: "success",
			name: "use_recipe_connector",
			content: "Connector operation completed",
			data: { ok: true },
		});
	});

	it("allows Devin session creation inside a Devin recipe scope", async () => {
		const result = await use_recipe_connector.execute(
			{
				provider: "devin",
				operation: "create_session",
				params: {
					organizationId: "org-abc123def456",
					prompt: "Review the repository and report implementation risks.",
					repos: ["nicholasgriffin/assistant"],
				},
			},
			createToolContext({
				allowedConnectorProviders: ["devin"],
				allowedConnectorOperations: {
					devin: [
						"list_sessions",
						"get_session",
						"create_session",
						"list_messages",
						"send_message",
					],
				},
			}),
		);

		expect(mocks.executeRecipeConnectorOperation).toHaveBeenCalledWith({
			context: {},
			userId: 42,
			request: {
				provider: "devin",
				operation: "create_session",
				params: {
					organizationId: "org-abc123def456",
					prompt: "Review the repository and report implementation risks.",
					repos: ["nicholasgriffin/assistant"],
				},
			},
		});
		expect(result).toEqual({
			status: "success",
			name: "use_recipe_connector",
			content: "Connector operation completed",
			data: { ok: true },
		});
	});

	it("allows Fitbit read operations inside a Fitbit recipe scope", async () => {
		const result = await use_recipe_connector.execute(
			{
				provider: "fitbit",
				operation: "sleep_logs",
				params: { date: "today" },
			},
			createToolContext({
				allowedConnectorProviders: ["fitbit"],
				allowedConnectorOperations: {
					fitbit: ["profile", "daily_activity", "sleep_logs", "heart_rate"],
				},
			}),
		);

		expect(mocks.executeRecipeConnectorOperation).toHaveBeenCalledWith({
			context: {},
			userId: 42,
			request: {
				provider: "fitbit",
				operation: "sleep_logs",
				params: { date: "today" },
			},
		});
		expect(result).toEqual({
			status: "success",
			name: "use_recipe_connector",
			content: "Connector operation completed",
			data: { ok: true },
		});
	});

	it("allows Withings read operations inside a Withings recipe scope", async () => {
		const result = await use_recipe_connector.execute(
			{
				provider: "withings",
				operation: "sleep_summary",
				params: { startDate: "2026-06-01", endDate: "2026-06-08" },
			},
			createToolContext({
				allowedConnectorProviders: ["withings"],
				allowedConnectorOperations: {
					withings: ["profile", "devices", "measurements", "activity", "sleep_summary"],
				},
			}),
		);

		expect(mocks.executeRecipeConnectorOperation).toHaveBeenCalledWith({
			context: {},
			userId: 42,
			request: {
				provider: "withings",
				operation: "sleep_summary",
				params: { startDate: "2026-06-01", endDate: "2026-06-08" },
			},
		});
		expect(result).toEqual({
			status: "success",
			name: "use_recipe_connector",
			content: "Connector operation completed",
			data: { ok: true },
		});
	});

	it("blocks connector write operations during scheduled recipe runs", async () => {
		const result = await use_recipe_connector.execute(
			{
				provider: "todoist",
				operation: "create_task",
				params: { content: "Follow up with finance" },
			},
			createToolContext({
				allowedConnectorProviders: ["todoist"],
				recipeChannel: "scheduled",
			}),
		);

		expect(result).toEqual({
			status: "error",
			name: "use_recipe_connector",
			content:
				"Scheduled recipe runs cannot perform connector write operations. Ask the user to run this recipe in chat if an external change is required.",
			data: {
				provider: "todoist",
				operation: "create_task",
				channel: "scheduled",
			},
		});
		expect(mocks.executeRecipeConnectorOperation).not.toHaveBeenCalled();
	});

	it("allows connector read operations during scheduled recipe runs", async () => {
		const result = await use_recipe_connector.execute(
			{
				provider: "todoist",
				operation: "list_tasks",
				params: { label: "work" },
			},
			createToolContext({
				allowedConnectorProviders: ["todoist"],
				recipeChannel: "scheduled",
			}),
		);

		expect(mocks.executeRecipeConnectorOperation).toHaveBeenCalledWith({
			context: {},
			userId: 42,
			request: {
				provider: "todoist",
				operation: "list_tasks",
				params: { label: "work" },
			},
		});
		expect(result).toEqual({
			status: "success",
			name: "use_recipe_connector",
			content: "Connector operation completed",
			data: { ok: true },
		});
	});

	it("keeps manually enabled connector tools unrestricted when no recipe scope is present", async () => {
		await use_recipe_connector.execute(
			{
				provider: "gmail",
				operation: "search_messages",
			},
			createToolContext(),
		);

		expect(mocks.executeRecipeConnectorOperation).toHaveBeenCalledWith(
			expect.objectContaining({
				request: expect.objectContaining({
					provider: "gmail",
				}),
			}),
		);
	});

	it("saves active recipe setup configuration and schedule triggers", async () => {
		const triggers = [
			{ type: "manual" as const, enabled: true },
			{
				type: "schedule" as const,
				enabled: true,
				cronExpression: "0 7 * * *",
				prompt: "Check for disruptive weather before the commute.",
			},
		];
		const installation = {
			id: "installation-1",
			recipeId: "bad-weather-alerts",
			userId: 42,
			status: "active",
			triggers,
			configuration: {
				location: "London",
				alertThreshold: "Heavy rain",
			},
			createdAt: "2026-06-20T10:00:00.000Z",
			updatedAt: "2026-06-20T10:00:00.000Z",
		};
		mocks.updateRecipeInstallation.mockResolvedValue(installation);

		const result = await configure_recipe.execute(
			{
				recipeId: "bad-weather-alerts",
				configuration: {
					location: "London",
					alertThreshold: "Heavy rain",
				},
				triggers,
			},
			createToolContext({
				recipe: {
					id: "bad-weather-alerts",
					installationId: "installation-1",
				},
			}),
		);

		expect(mocks.updateRecipeInstallation).toHaveBeenCalledWith({
			context: {},
			userId: 42,
			installationId: "installation-1",
			update: {
				configuration: {
					location: "London",
					alertThreshold: "Heavy rain",
				},
				triggers,
			},
		});
		expect(result).toEqual({
			status: "success",
			name: "configure_recipe",
			content: "Recipe setup saved.",
			data: { installation },
		});
	});

	it("rejects SMS recipe notifications when SMS is not configured", async () => {
		const result = await configure_recipe.execute(
			{
				recipeId: "bad-weather-alerts",
				configuration: {
					location: "London",
				},
				triggers: [
					{ type: "manual", enabled: true },
					{
						type: "schedule",
						enabled: true,
						cronExpression: "0 7 * * *",
						notificationChannel: "sms",
						notificationTarget: "+15551234567",
					},
				],
			},
			createToolContext({
				recipe: {
					id: "bad-weather-alerts",
					installationId: "installation-1",
				},
				userProviderSettings: [],
			}),
		);

		expect(result).toMatchObject({
			status: "needs_correction",
			name: "configure_recipe",
			data: {
				recipeId: "bad-weather-alerts",
				installationId: "installation-1",
				recoverable: true,
				notificationCapabilities: {
					sms: {
						available: false,
						configuredProviders: [],
					},
				},
			},
		});
		expect(result.content).toContain("SMS notifications are not configured");
		expect(mocks.updateRecipeInstallation).not.toHaveBeenCalled();
	});

	it("allows SMS recipe notifications when a messaging provider is configured", async () => {
		const triggers = [
			{ type: "manual" as const, enabled: true },
			{
				type: "schedule" as const,
				enabled: true,
				cronExpression: "0 7 * * *",
				notificationChannel: "sms" as const,
				notificationTarget: "+15551234567",
			},
		];
		const installation = {
			id: "installation-1",
			recipeId: "bad-weather-alerts",
			userId: 42,
			status: "active",
			triggers,
			configuration: {
				location: "London",
			},
			createdAt: "2026-06-20T10:00:00.000Z",
			updatedAt: "2026-06-20T10:00:00.000Z",
		};
		mocks.updateRecipeInstallation.mockResolvedValue(installation);

		const result = await configure_recipe.execute(
			{
				recipeId: "bad-weather-alerts",
				configuration: {
					location: "London",
				},
				triggers,
			},
			createToolContext({
				recipe: {
					id: "bad-weather-alerts",
					installationId: "installation-1",
				},
				userProviderSettings: [
					{
						id: "twilio-settings",
						provider_id: "twilio-sms",
						type: "messaging",
						enabled: true,
						hasApiKey: true,
					},
				],
			}),
		);

		expect(mocks.updateRecipeInstallation).toHaveBeenCalledWith(
			expect.objectContaining({
				installationId: "installation-1",
				update: expect.objectContaining({ triggers }),
			}),
		);
		expect(result).toMatchObject({
			status: "success",
			name: "configure_recipe",
			data: { installation },
		});
	});

	it("rejects recipe setup saves outside an active installed recipe setup chat", async () => {
		const result = await configure_recipe.execute(
			{
				recipeId: "bad-weather-alerts",
				configuration: {
					location: "London",
				},
			},
			createToolContext(),
		);

		expect(result).toEqual({
			status: "error",
			name: "configure_recipe",
			content: "No active installed recipe is available to configure in this chat.",
			data: { recipeId: undefined },
		});
		expect(mocks.updateRecipeInstallation).not.toHaveBeenCalled();
	});

	it("rejects recipe setup saves for a different recipe", async () => {
		const result = await configure_recipe.execute(
			{
				recipeId: "daily-weather",
				configuration: {
					location: "London",
				},
			},
			createToolContext({
				recipe: {
					id: "bad-weather-alerts",
					installationId: "installation-1",
				},
			}),
		);

		expect(result).toEqual({
			status: "error",
			name: "configure_recipe",
			content: "The requested recipe does not match the active recipe setup chat.",
			data: {
				recipeId: "daily-weather",
				activeRecipeId: "bad-weather-alerts",
			},
		});
		expect(mocks.updateRecipeInstallation).not.toHaveBeenCalled();
	});

	it("returns recoverable correction details for invalid recipe setup fields", async () => {
		mocks.updateRecipeInstallation.mockRejectedValue(
			new AssistantError(
				"Bad Weather Alerts scheduled triggers require recipe configuration: Location",
				ErrorType.PARAMS_ERROR,
				400,
			),
		);

		const result = await configure_recipe.execute(
			{
				recipeId: "bad-weather-alerts",
				configuration: {
					location_name: "Park Royal, London",
					latitude: 51.6185,
					longitude: -0.5594,
				},
				triggers: [
					{ type: "manual", enabled: true },
					{
						type: "schedule",
						enabled: true,
						cronExpression: "0 7 * * *",
					},
				],
			},
			createToolContext({
				recipe: {
					id: "bad-weather-alerts",
					installationId: "installation-1",
				},
			}),
		);

		expect(result).toMatchObject({
			status: "needs_correction",
			name: "configure_recipe",
			data: {
				recipeId: "bad-weather-alerts",
				installationId: "installation-1",
				recoverable: true,
			},
		});
		expect(result.content).toContain(
			"Bad Weather Alerts scheduled triggers require recipe configuration: Location",
		);
		expect(result.content).toContain("Call get_recipe for the exact configuration field keys");
		expect(mocks.getAssistantRecipe).not.toHaveBeenCalled();
	});

	it("gets active recipe setup configuration fields", async () => {
		const result = await get_recipe.execute(
			{},
			createToolContext({
				recipe: {
					id: "bad-weather-alerts",
					installationId: "installation-1",
				},
			}),
		);

		expect(mocks.getAssistantRecipe).toHaveBeenCalledWith("bad-weather-alerts", {
			context: {},
			userId: 42,
			requestUrl: "https://app.example.com",
		});
		expect(result).toEqual({
			status: "success",
			name: "get_recipe",
			content:
				"Recipe configuration fields loaded. SMS notification availability is unknown. Do not save SMS notification triggers unless the user connects SMS first.",
			data: {
				recipeId: "bad-weather-alerts",
				title: "Bad Weather Alerts",
				channel: undefined,
				enabledTools: ["get_weather"],
				triggers: [{ type: "schedule", label: "Morning alert" }],
				configurationFields: [
					{
						key: "location",
						label: "Location",
						type: "text",
						required: true,
					},
					{
						key: "alertThresholds",
						label: "Alert thresholds",
						type: "string_list",
					},
					{
						key: "forecastTime",
						label: "Forecast time",
						type: "text",
					},
				],
				notificationCapabilities: {
					sms: {
						available: false,
						configuredProviders: [],
						guidance:
							"SMS notification availability is unknown. Do not save SMS notification triggers unless the user connects SMS first.",
					},
				},
				savedConfiguration: undefined,
			},
		});
	});

	it("reports configured SMS notification capability in active recipe context", async () => {
		const result = await get_recipe.execute(
			{},
			createToolContext({
				recipe: {
					id: "bad-weather-alerts",
					installationId: "installation-1",
				},
				userProviderSettings: [
					{
						id: "twilio-settings",
						provider_id: "twilio-sms",
						type: "messaging",
						enabled: true,
						hasApiKey: true,
					},
				],
			}),
		);

		expect(result).toMatchObject({
			status: "success",
			name: "get_recipe",
			data: {
				notificationCapabilities: {
					sms: {
						available: true,
						configuredProviders: ["twilio-sms"],
					},
				},
			},
		});
		expect(result.content).toContain("SMS notifications are available");
	});

	it("passes recent non-tool chat context into natural language recipe executions", async () => {
		const priorMessages = [
			{ role: "user", content: "older context" },
			{ role: "assistant", content: "I can run that recipe." },
			{ role: "user", content: "Use the London office." },
		];
		const invocation = {
			recipeId: "daily-weather",
			status: "ready",
			enabledTools: ["get_weather"],
			conversationStarter: "Run daily weather",
			missingConnections: [],
			configuration: { location: "London" },
		};
		mocks.resolveInstalledAssistantRecipe.mockResolvedValue({
			status: "matched",
			recipe: { id: "daily-weather" },
			candidates: [],
		});
		mocks.invokeAssistantRecipe.mockResolvedValue(invocation);
		mocks.executeRecipeInvocationChat.mockResolvedValue({
			conversationId: "recipe-conversation",
			response: { choices: [{ message: { content: "Weather summary" } }] },
		});
		mocks.getRecipeConversationContext.mockResolvedValue(priorMessages);

		const result = await trigger_recipe.execute(
			{ query: "run my weather recipe" },
			createToolContext(),
		);

		expect(mocks.getRecipeConversationContext).toHaveBeenCalledWith({
			conversationManager: undefined,
			conversationId: "completion-id",
		});
		expect(mocks.executeRecipeInvocationChat).toHaveBeenCalledWith({
			env: expect.any(Object),
			context: {},
			user: { id: 42 },
			invocation,
			priorMessages: [
				{ role: "user", content: "older context" },
				{ role: "assistant", content: "I can run that recipe." },
				{ role: "user", content: "Use the London office." },
			],
		});
		expect(mocks.invokeAssistantRecipe).toHaveBeenCalledWith("daily-weather", {
			context: {},
			userId: 42,
			channel: "tool",
			input: "run my weather recipe",
			requireInstalled: true,
		});
		expect(result).toMatchObject({
			status: "success",
			name: "trigger_recipe",
			content: "Weather summary",
			data: {
				executionConversationId: "recipe-conversation",
				notification: {
					body: "Weather summary",
					mediaUrls: [],
				},
				mediaUrls: [],
			},
		});
	});

	it("returns recipe media in natural language recipe tool results", async () => {
		const qrImageUrl = "http://pashi.app/api/qr?data=polychat&format=png&size=520x520";
		const invocation = {
			recipeId: "quick-qr-generator",
			status: "ready",
			enabledTools: ["create_qr_code"],
			conversationStarter: "Run QR recipe",
			missingConnections: [],
			configuration: {},
		};
		mocks.resolveInstalledAssistantRecipe.mockResolvedValue({
			status: "matched",
			recipe: { id: "quick-qr-generator" },
			candidates: [],
		});
		mocks.invokeAssistantRecipe.mockResolvedValue(invocation);
		mocks.executeRecipeInvocationChat.mockResolvedValue({
			conversationId: "recipe-conversation",
			response: {
				choices: [
					{
						message: {
							content: "QR code ready.",
						},
					},
					{
						message: {
							role: "tool",
							name: "create_qr_code",
							content: "QR code image created.",
							data: {
								imageUrl: qrImageUrl,
							},
						},
						finish_reason: "tool_result",
					},
				],
			},
		});

		const result = await trigger_recipe.execute(
			{ query: "make a qr code for https://polychat.app" },
			createToolContext(),
		);

		expect(result).toMatchObject({
			status: "success",
			name: "trigger_recipe",
			content: "QR code ready.",
			data: {
				executionConversationId: "recipe-conversation",
				notification: {
					body: "QR code ready.",
					mediaUrls: [qrImageUrl],
				},
				mediaUrls: [qrImageUrl],
			},
		});
	});

	it("preserves SMS channel and sender context when the chat fallback triggers a recipe", async () => {
		const invocation = {
			recipeId: "daily-weather",
			status: "ready",
			channel: "sms",
			enabledTools: ["get_weather"],
			conversationStarter: "Run daily weather over SMS",
			missingConnections: [],
			configuration: { location: "London" },
		};
		mocks.resolveInstalledAssistantRecipe.mockResolvedValue({
			status: "matched",
			recipe: { id: "daily-weather" },
			candidates: [],
		});
		mocks.invokeAssistantRecipe.mockResolvedValue(invocation);
		mocks.executeRecipeInvocationChat.mockResolvedValue({
			conversationId: "recipe-conversation",
			response: { choices: [{ message: { content: "Weather summary" } }] },
		});

		const result = await trigger_recipe.execute(
			{ query: "run my weather recipe" },
			createToolContext({
				sms: {
					from: "+15551234567",
					to: "+15557654321",
				},
			}),
		);

		expect(mocks.invokeAssistantRecipe).toHaveBeenCalledWith("daily-weather", {
			context: {},
			userId: 42,
			channel: "sms",
			input: "run my weather recipe",
			requireInstalled: true,
		});
		expect(mocks.executeRecipeInvocationChat).toHaveBeenCalledWith({
			env: expect.any(Object),
			context: {},
			user: { id: 42 },
			invocation,
			priorMessages: [],
			sms: {
				from: "+15551234567",
				to: "+15557654321",
			},
		});
		expect(result).toMatchObject({
			status: "success",
			content: "Weather summary",
		});
	});
});
