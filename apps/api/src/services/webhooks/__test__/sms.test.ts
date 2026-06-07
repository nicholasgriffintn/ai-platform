import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createServiceContext: vi.fn(),
	getMessagingProvider: vi.fn(),
	parseMessagingCredentialEnvelope: vi.fn(),
	resolveInstalledAssistantRecipe: vi.fn(),
	invokeAssistantRecipe: vi.fn(),
	executeRecipeInvocationChat: vi.fn(),
	handleCreateChatCompletions: vi.fn(),
	providerSend: vi.fn(),
	providerParseIncoming: vi.fn(),
}));

vi.mock("~/lib/context/serviceContext", () => ({
	createServiceContext: mocks.createServiceContext,
}));

vi.mock("~/lib/providers/capabilities/messaging", async (importOriginal) => {
	const original = await importOriginal<typeof import("~/lib/providers/capabilities/messaging")>();
	return {
		...original,
		getMessagingProvider: mocks.getMessagingProvider,
		parseMessagingCredentialEnvelope: mocks.parseMessagingCredentialEnvelope,
	};
});

vi.mock("~/services/apps/recipes", () => ({
	resolveInstalledAssistantRecipe: mocks.resolveInstalledAssistantRecipe,
	invokeAssistantRecipe: mocks.invokeAssistantRecipe,
}));

vi.mock("~/services/apps/recipes/execution", () => ({
	executeRecipeInvocationChat: mocks.executeRecipeInvocationChat,
}));

vi.mock("~/services/completions/createChatCompletions", () => ({
	handleCreateChatCompletions: mocks.handleCreateChatCompletions,
}));

import { handleSmsAssistantWebhook } from "../sms";

const testUser = {
	id: 42,
	email: "user@example.com",
	name: null,
	avatar_url: null,
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
	plan_id: "pro",
};

function createMockContext() {
	return {
		env: { DB: {}, API_BASE_URL: "https://api.polychat.test" },
		req: {
			param: vi.fn((key: string) =>
				key === "providerId" ? "twilio-sms" : key === "providerSettingsId" ? "provider-row-1" : "",
			),
		},
		get: vi.fn((key: string) => (key === "requestId" ? "request-1" : undefined)),
		json: vi.fn((body: unknown) => new Response(JSON.stringify(body))),
	} as any;
}

function createRepositories(overrides: Record<string, unknown> = {}) {
	return {
		userSettings: {
			getProviderSettingsById: vi.fn(async () => ({
				id: "provider-row-1",
				user_id: 42,
				provider_id: "twilio-sms",
				enabled: 1,
			})),
			getProviderApiKey: vi.fn(async () => "encrypted-config"),
		},
		users: {
			getUserById: vi.fn(async () => testUser),
		},
		tasks: {
			getTaskById: vi.fn(),
			getTasksByUserId: vi.fn(async () => []),
		},
		...overrides,
	};
}

function prepareServiceContext(repositories = createRepositories()) {
	const context = {
		env: { DB: {}, API_BASE_URL: "https://api.polychat.test" },
		repositories,
	};
	mocks.createServiceContext.mockReturnValue(context);
	return context;
}

describe("SMS webhook service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.providerParseIncoming.mockResolvedValue({
			kind: "message",
			from: "+15551234567",
			to: "+15557654321",
			body: "hello",
		});
		mocks.getMessagingProvider.mockReturnValue({
			parseIncoming: mocks.providerParseIncoming,
			send: mocks.providerSend,
		});
		mocks.parseMessagingCredentialEnvelope.mockReturnValue({
			version: 1,
			providerId: "twilio-sms",
			credentials: {
				accountSid: "AC123",
				authToken: "secret",
				fromNumber: "+15557654321",
			},
		});
		mocks.resolveInstalledAssistantRecipe.mockResolvedValue({
			status: "not_found",
			candidates: [],
		});
		mocks.handleCreateChatCompletions.mockResolvedValue({
			choices: [{ message: { content: "chat reply" } }],
		});
	});

	it("responds with recent task status without invoking chat", async () => {
		const repositories = createRepositories({
			tasks: {
				getTaskById: vi.fn(),
				getTasksByUserId: vi.fn(async () => [
					{
						id: "task-1",
						task_type: "recipe_execution",
						status: "running",
						created_at: "2026-06-07T10:00:00.000Z",
					},
				]),
			},
		});
		prepareServiceContext(repositories);
		mocks.providerParseIncoming.mockResolvedValue({
			kind: "message",
			from: "+15551234567",
			to: "+15557654321",
			body: "task status",
		});

		await handleSmsAssistantWebhook(createMockContext());

		expect(mocks.handleCreateChatCompletions).not.toHaveBeenCalled();
		expect(mocks.providerSend).toHaveBeenCalledWith({
			to: "+15551234567",
			body: expect.stringContaining("recipe_execution task-1: running"),
		});
	});

	it("executes a matched installed recipe", async () => {
		prepareServiceContext();
		mocks.providerParseIncoming.mockResolvedValue({
			kind: "message",
			from: "+15551234567",
			to: "+15557654321",
			body: "run daily weather",
		});
		mocks.resolveInstalledAssistantRecipe.mockResolvedValue({
			status: "matched",
			recipe: { id: "daily-weather" },
			candidates: [],
		});
		mocks.invokeAssistantRecipe.mockResolvedValue({
			recipeId: "daily-weather",
			status: "ready",
			enabledTools: ["get_weather"],
			conversationStarter: "Daily weather recipe",
			missingConnections: [],
			configuration: { location: "London" },
		});
		mocks.executeRecipeInvocationChat.mockResolvedValue({
			conversationId: "recipe-conversation",
			response: { choices: [{ message: { content: "Weather summary" } }] },
		});

		await handleSmsAssistantWebhook(createMockContext());

		expect(mocks.invokeAssistantRecipe).toHaveBeenCalledWith("daily-weather", {
			context: expect.any(Object),
			userId: 42,
			channel: "sms",
			input: "run daily weather",
			requireInstalled: true,
		});
		expect(mocks.providerSend).toHaveBeenCalledWith({
			to: "+15551234567",
			body: "Weather summary",
		});
	});

	it("passes SMS mode options to bounded chat fallback without a system message", async () => {
		prepareServiceContext();
		mocks.providerParseIncoming.mockResolvedValue({
			kind: "message",
			from: "+15551234567",
			to: "+15557654321",
			body: "what is the weather?",
		});

		await handleSmsAssistantWebhook(createMockContext());

		expect(mocks.handleCreateChatCompletions).toHaveBeenCalledWith(
			expect.objectContaining({
				request: expect.objectContaining({
					messages: [{ role: "user", content: "what is the weather?" }],
					options: expect.objectContaining({
						sms: {
							enabled: true,
							from: "+15551234567",
							to: "+15557654321",
						},
					}),
				}),
			}),
		);
		expect(mocks.providerSend).toHaveBeenCalledWith({
			to: "+15551234567",
			body: "chat reply",
		});
	});

	it("returns provider control responses without invoking assistant work", async () => {
		prepareServiceContext();
		mocks.providerParseIncoming.mockResolvedValue({
			kind: "control",
			response: {
				success: true,
				message: "AWS SNS subscription confirmed",
			},
		});

		const response = await handleSmsAssistantWebhook(createMockContext());

		expect(await response.json()).toEqual({
			success: true,
			message: "AWS SNS subscription confirmed",
		});
		expect(mocks.handleCreateChatCompletions).not.toHaveBeenCalled();
		expect(mocks.executeRecipeInvocationChat).not.toHaveBeenCalled();
		expect(mocks.providerSend).not.toHaveBeenCalled();
	});
});
