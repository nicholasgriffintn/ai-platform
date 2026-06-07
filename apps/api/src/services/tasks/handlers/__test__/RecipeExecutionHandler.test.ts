import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";
import { RecipeExecutionHandler } from "../RecipeExecutionHandler";
import type { TaskMessage } from "../../TaskService";

const mocks = vi.hoisted(() => ({
	getUserById: vi.fn(),
	getProviderApiKey: vi.fn(),
	getUserProviderSettings: vi.fn(),
	invokeAssistantRecipe: vi.fn(),
	executeRecipeInvocationChat: vi.fn(),
	parseMessagingCredentialEnvelope: vi.fn(),
	providerSend: vi.fn(),
}));

vi.mock("~/lib/context/serviceContext", () => ({
	createServiceContext: vi.fn(({ env, user }) => ({
		env,
		user: user ?? null,
		repositories: {
			users: {
				getUserById: mocks.getUserById,
			},
			userSettings: {
				getProviderApiKey: mocks.getProviderApiKey,
				getUserProviderSettings: mocks.getUserProviderSettings,
			},
		},
	})),
}));

vi.mock("~/lib/providers/capabilities/messaging", () => ({
	getMessagingProvider: vi.fn(() => ({
		send: mocks.providerSend,
	})),
	isMessagingProviderId: vi.fn((providerId: string) =>
		["twilio-sms", "aws-sms"].includes(providerId),
	),
	parseMessagingCredentialEnvelope: mocks.parseMessagingCredentialEnvelope,
}));

vi.mock("~/services/apps/recipes", () => ({
	invokeAssistantRecipe: mocks.invokeAssistantRecipe,
}));

vi.mock("~/services/apps/recipes/execution", () => ({
	executeRecipeInvocationChat: mocks.executeRecipeInvocationChat,
}));

const env = { DB: {} } as unknown as IEnv;

const user: IUser = {
	id: 42,
	name: "Test User",
	avatar_url: null,
	email: "test@example.com",
	github_username: null,
	company: null,
	site: null,
	location: null,
	bio: null,
	twitter_username: null,
	role: null,
	created_at: "2026-06-07T10:00:00.000Z",
	updated_at: "2026-06-07T10:00:00.000Z",
	setup_at: null,
	terms_accepted_at: null,
	plan_id: "pro",
};

const baseMessage: TaskMessage = {
	taskId: "task-1",
	task_type: "recipe_execution",
	user_id: 42,
	task_data: {
		recipeId: "morning-briefing",
		input: "Run briefing",
		channel: "scheduled",
	},
	priority: 5,
};

describe("RecipeExecutionHandler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getUserById.mockResolvedValue(user);
		mocks.getUserProviderSettings.mockResolvedValue([]);
		mocks.getProviderApiKey.mockResolvedValue(null);
		mocks.parseMessagingCredentialEnvelope.mockReturnValue({
			version: 1,
			providerId: "twilio-sms",
			credentials: {
				accountSid: "AC123",
				authToken: "secret",
				fromNumber: "+15557654321",
			},
		});
	});

	it("returns an error when required task data is missing", async () => {
		const result = await new RecipeExecutionHandler().handle(
			{
				...baseMessage,
				task_data: {},
			},
			env,
		);

		expect(result).toMatchObject({
			status: "error",
			message: "user_id and recipeId are required for recipe execution",
		});
		expect(mocks.invokeAssistantRecipe).not.toHaveBeenCalled();
	});

	it("returns an error when the task user no longer exists", async () => {
		mocks.getUserById.mockResolvedValue(null);

		const result = await new RecipeExecutionHandler().handle(baseMessage, env);

		expect(result).toMatchObject({
			status: "error",
			message: "User 42 not found for recipe execution",
		});
		expect(mocks.invokeAssistantRecipe).not.toHaveBeenCalled();
	});

	it("skips blocked recipe invocations without running chat", async () => {
		mocks.invokeAssistantRecipe.mockResolvedValue({
			recipeId: "morning-briefing",
			installationId: "installation-1",
			status: "blocked",
			conversationStarter: "Connect calendar",
			messageUrl: "/?query=Connect",
			missingConnections: [{ providerId: "calendar" }],
			enabledTools: ["use_recipe_connector"],
			configuration: {},
		});

		const result = await new RecipeExecutionHandler().handle(baseMessage, env);

		expect(result).toMatchObject({
			status: "skipped",
			message: "Recipe execution blocked by missing connectors",
		});
		expect(mocks.executeRecipeInvocationChat).not.toHaveBeenCalled();
	});

	it("requires an installed recipe for scheduled execution", async () => {
		mocks.invokeAssistantRecipe.mockResolvedValue({
			recipeId: "morning-briefing",
			status: "not_installed",
			conversationStarter: "Install recipe",
			messageUrl: "/?query=Install",
			missingConnections: [],
			enabledTools: ["use_recipe_connector"],
			configuration: {},
		});

		const result = await new RecipeExecutionHandler().handle(baseMessage, env);

		expect(mocks.invokeAssistantRecipe).toHaveBeenCalledWith("morning-briefing", {
			context: expect.objectContaining({ user }),
			userId: 42,
			channel: "scheduled",
			input: "Run briefing",
			requireInstalled: true,
		});
		expect(result).toMatchObject({
			status: "skipped",
			message: "Recipe execution skipped because the recipe is not installed",
		});
		expect(mocks.executeRecipeInvocationChat).not.toHaveBeenCalled();
	});

	it("runs ready recipe invocations through the chat completion pipeline", async () => {
		const invocation = {
			recipeId: "morning-briefing",
			installationId: "installation-1",
			status: "ready",
			conversationStarter: "Run the saved briefing recipe",
			messageUrl: "/?query=Run",
			missingConnections: [],
			enabledTools: ["use_recipe_connector"],
			configuration: { target: "work inbox" },
		};
		mocks.invokeAssistantRecipe.mockResolvedValue(invocation);
		mocks.executeRecipeInvocationChat.mockResolvedValue({
			conversationId: "recipe-conversation-1",
			response: {
				id: "recipe-conversation-1",
				object: "chat.completion",
				created: 1,
				log_id: "log-1",
				choices: [],
			},
		});

		const result = await new RecipeExecutionHandler().handle(baseMessage, env);

		expect(mocks.executeRecipeInvocationChat).toHaveBeenCalledWith({
			env,
			context: expect.objectContaining({ user }),
			user,
			invocation,
		});
		expect(result).toMatchObject({
			status: "success",
			message: "Recipe execution completed",
			data: {
				recipeId: "morning-briefing",
				conversationId: "recipe-conversation-1",
			},
		});
	});

	it("sends scheduled recipe results to the configured SMS provider when requested", async () => {
		const invocation = {
			recipeId: "daily-weather",
			installationId: "installation-1",
			status: "ready",
			conversationStarter: "Run weather",
			messageUrl: "/?query=Run",
			missingConnections: [],
			enabledTools: ["get_weather"],
			configuration: { location: "London" },
		};
		mocks.invokeAssistantRecipe.mockResolvedValue(invocation);
		mocks.executeRecipeInvocationChat.mockResolvedValue({
			conversationId: "recipe-conversation-1",
			response: {
				choices: [{ message: { content: "Bring an umbrella." } }],
			},
		});
		mocks.getUserProviderSettings.mockResolvedValue([
			{
				provider_id: "twilio-sms",
				type: "messaging",
				enabled: true,
				hasApiKey: true,
			},
		]);
		mocks.getProviderApiKey.mockResolvedValue("encrypted-config");

		const result = await new RecipeExecutionHandler().handle(
			{
				...baseMessage,
				task_data: {
					recipeId: "daily-weather",
					input: "Run weather",
					channel: "scheduled",
					notificationChannel: "sms",
					notificationTarget: "+15551234567",
				},
			},
			env,
		);

		expect(mocks.getProviderApiKey).toHaveBeenCalledWith(42, "twilio-sms");
		expect(mocks.providerSend).toHaveBeenCalledWith({
			to: "+15551234567",
			body: "Bring an umbrella.",
		});
		expect(result).toMatchObject({
			status: "success",
			message: "Recipe execution completed",
		});
	});
});
