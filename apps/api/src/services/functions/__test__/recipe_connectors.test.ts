import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "~/lib/tools/ToolExecutionContext";
import type { IEnv, IRequest, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

const mocks = vi.hoisted(() => ({
	executeRecipeConnectorOperation: vi.fn(),
	resolveInstalledAssistantRecipe: vi.fn(),
	invokeAssistantRecipe: vi.fn(),
	executeRecipeInvocationChat: vi.fn(),
	getRecipeConversationContext: vi.fn(),
}));

vi.mock("~/services/apps/connectors/operations", () => ({
	executeRecipeConnectorOperation: mocks.executeRecipeConnectorOperation,
}));

vi.mock("~/services/apps/recipes", () => ({
	resolveInstalledAssistantRecipe: mocks.resolveInstalledAssistantRecipe,
	invokeAssistantRecipe: mocks.invokeAssistantRecipe,
}));

vi.mock("~/services/apps/recipes/execution", () => ({
	executeRecipeInvocationChat: mocks.executeRecipeInvocationChat,
}));

vi.mock("~/services/apps/recipes/conversationContext", () => ({
	getRecipeConversationContext: mocks.getRecipeConversationContext,
}));

import { trigger_recipe, use_recipe_connector } from "../recipe_connectors";

function createToolContext(
	params: {
		allowedConnectorProviders?: string[];
		allowedConnectorOperations?: Record<string, string[]>;
		recipeChannel?: "web" | "ios" | "sms" | "scheduled" | "tool";
		sms?: {
			from?: string;
			to?: string;
		};
	} = {},
) {
	const env = {} as IEnv;
	const user = { id: 42 } as IUser;
	const request: IRequest = {
		env,
		context: {} as IRequest["context"],
		user,
		request: {
			completion_id: "completion-id",
			input: "use a connector",
			date: "2026-06-07T10:00:00.000Z",
			...(params.allowedConnectorProviders === undefined && !params.sms
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
								? {}
								: {
										recipe: {
											id: "notion-action-log",
											allowedConnectorProviders: params.allowedConnectorProviders,
											allowedConnectorOperations: params.allowedConnectorOperations,
											channel: params.recipeChannel,
										},
									}),
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
							content: "QR code image URL created.",
							data: {
								imageUrl:
									"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https%3A%2F%2Fpolychat.app",
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
					mediaUrls: [
						"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https%3A%2F%2Fpolychat.app",
					],
				},
				mediaUrls: [
					"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https%3A%2F%2Fpolychat.app",
				],
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
