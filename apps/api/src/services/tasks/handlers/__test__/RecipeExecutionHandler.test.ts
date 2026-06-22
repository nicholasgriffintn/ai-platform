import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";
import { RecipeExecutionHandler } from "../RecipeExecutionHandler";
import type { TaskMessage } from "../../TaskService";

const mocks = vi.hoisted(() => ({
	getUserById: vi.fn(),
	getProviderApiKey: vi.fn(),
	getProviderApiKeyForSettings: vi.fn(),
	getUserProviderSettings: vi.fn(),
	invokeAssistantRecipe: vi.fn(),
	executeRecipeInvocationChat: vi.fn(),
	recordRecipeInvocationFailure: vi.fn(),
	getMessagingProviderFromStoredCredential: vi.fn(),
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
				getProviderApiKeyForSettings: mocks.getProviderApiKeyForSettings,
				getUserProviderSettings: mocks.getUserProviderSettings,
			},
		},
	})),
}));

vi.mock("~/lib/providers/capabilities/messaging/delivery", async (importOriginal) => {
	const original =
		await importOriginal<typeof import("~/lib/providers/capabilities/messaging/delivery")>();

	return {
		...original,
		getMessagingProviderFromStoredCredential: mocks.getMessagingProviderFromStoredCredential,
	};
});

vi.mock("~/services/apps/recipes", () => ({
	invokeAssistantRecipe: mocks.invokeAssistantRecipe,
}));

vi.mock("~/services/apps/recipes/execution", () => ({
	executeRecipeInvocationChat: mocks.executeRecipeInvocationChat,
	recordRecipeInvocationFailure: mocks.recordRecipeInvocationFailure,
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
		mocks.getProviderApiKeyForSettings.mockResolvedValue(null);
		mocks.getMessagingProviderFromStoredCredential.mockReturnValue({
			send: mocks.providerSend,
		});
		mocks.recordRecipeInvocationFailure.mockResolvedValue(
			"Recipe execution failed before I could complete the run: Provider unavailable",
		);
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
			configuration: undefined,
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

		expect(mocks.invokeAssistantRecipe).toHaveBeenCalledWith("morning-briefing", {
			context: expect.objectContaining({ user }),
			userId: 42,
			channel: "scheduled",
			input: "Run briefing",
			configuration: undefined,
			requireInstalled: true,
		});
		expect(mocks.executeRecipeInvocationChat).toHaveBeenCalledWith({
			env,
			context: expect.objectContaining({ user }),
			user,
			invocation,
			conversationId: "recipe_task-1",
			titleConversation: true,
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

	it("passes queued task configuration into recipe invocation", async () => {
		const invocation = {
			recipeId: "daily-weather",
			installationId: "installation-1",
			status: "ready",
			conversationStarter: "Run weather",
			messageUrl: "/?query=Run",
			missingConnections: [],
			enabledTools: ["get_weather"],
			configuration: { location: "Cambridge" },
		};
		mocks.invokeAssistantRecipe.mockResolvedValue(invocation);
		mocks.executeRecipeInvocationChat.mockResolvedValue({
			conversationId: "recipe-conversation-1",
			response: {
				choices: [],
			},
		});

		await new RecipeExecutionHandler().handle(
			{
				...baseMessage,
				task_data: {
					recipeId: "daily-weather",
					input: "Run weather",
					channel: "scheduled",
					configuration: {
						location: "Cambridge",
						forecastTime: "09:05",
					},
				},
			},
			env,
		);

		expect(mocks.invokeAssistantRecipe).toHaveBeenCalledWith("daily-weather", {
			context: expect.objectContaining({ user }),
			userId: 42,
			channel: "scheduled",
			input: "Run weather",
			configuration: {
				location: "Cambridge",
				forecastTime: "09:05",
			},
			requireInstalled: true,
		});
		expect(mocks.executeRecipeInvocationChat).toHaveBeenCalledWith({
			env,
			context: expect.objectContaining({ user }),
			user,
			invocation,
			conversationId: "recipe_task-1",
			titleConversation: true,
		});
	});

	it("records recipe chat failures without retrying the task", async () => {
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
		const error = new Error("Provider unavailable");
		mocks.invokeAssistantRecipe.mockResolvedValue(invocation);
		mocks.executeRecipeInvocationChat.mockRejectedValue(error);

		const result = await new RecipeExecutionHandler().handle(
			{
				...baseMessage,
				task_data: {
					recipeId: "daily-weather",
					input: "Run weather",
					channel: "scheduled",
				},
			},
			env,
		);

		expect(mocks.recordRecipeInvocationFailure).toHaveBeenCalledWith({
			env,
			context: expect.objectContaining({ user }),
			user,
			invocation,
			conversationId: "recipe_task-1",
			error,
		});
		expect(result).toMatchObject({
			status: "success",
			message: "Recipe execution failed and was recorded",
			data: {
				conversationId: "recipe_task-1",
				error: "Provider unavailable",
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
				id: "provider-row-1",
				provider_id: "twilio-sms",
				type: "messaging",
				enabled: true,
				hasApiKey: true,
			},
		]);
		mocks.getProviderApiKeyForSettings.mockResolvedValue("encrypted-config");

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

		expect(mocks.getProviderApiKeyForSettings).toHaveBeenCalledWith({
			userId: 42,
			providerId: "twilio-sms",
			providerSettingsId: "provider-row-1",
		});
		expect(mocks.providerSend).toHaveBeenCalledWith({
			to: "+15551234567",
			body: "Bring an umbrella.",
		});
		expect(result).toMatchObject({
			status: "success",
			message: "Recipe execution completed",
			data: {
				notificationDelivery: {
					channel: "sms",
					status: "sent",
				},
			},
		});
	});

	it("does not retry completed recipe executions when SMS notification delivery fails", async () => {
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
		mocks.getUserProviderSettings.mockResolvedValue([]);

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

		expect(mocks.executeRecipeInvocationChat).toHaveBeenCalledWith({
			env,
			context: expect.objectContaining({ user }),
			user,
			invocation,
			conversationId: "recipe_task-1",
			titleConversation: true,
		});
		expect(mocks.providerSend).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			status: "success",
			message: "Recipe execution completed",
			data: {
				notificationDelivery: {
					channel: "sms",
					status: "failed",
					error: "No configured SMS provider can send this scheduled recipe notification",
				},
			},
		});
	});

	it("sends scheduled recipe S3 media outputs through AWS End User Messaging when available", async () => {
		const invocation = {
			recipeId: "photo-nutrition-check",
			installationId: "installation-1",
			status: "ready",
			conversationStarter: "Check the saved nutrition recipe",
			messageUrl: "/?query=Run",
			missingConnections: [],
			enabledTools: [],
			configuration: {},
		};
		mocks.invokeAssistantRecipe.mockResolvedValue(invocation);
		mocks.executeRecipeInvocationChat.mockResolvedValue({
			conversationId: "recipe-conversation-1",
			response: {
				choices: [
					{
						message: {
							content: [
								{ type: "text", text: "Nutrition summary attached." },
								{
									type: "image_url",
									image_url: {
										url: "https://api.polychat.test/assets/nutrition-image",
									},
								},
							],
							data: {
								assets: [
									{
										url: "https://api.polychat.test/assets/nutrition-image",
									},
									{
										url: "s3://polychat-mms/generated/nutrition-image.png",
									},
								],
							},
						},
					},
				],
			},
		});
		mocks.getUserProviderSettings.mockResolvedValue([
			{
				id: "provider-row-1",
				provider_id: "twilio-sms",
				type: "messaging",
				enabled: true,
				hasApiKey: true,
			},
			{
				id: "provider-row-2",
				provider_id: "aws-sms",
				type: "messaging",
				enabled: true,
				hasApiKey: true,
			},
		]);
		mocks.getProviderApiKeyForSettings.mockResolvedValue("encrypted-config");

		await new RecipeExecutionHandler().handle(
			{
				...baseMessage,
				task_data: {
					recipeId: "photo-nutrition-check",
					input: "Run nutrition check",
					channel: "scheduled",
					notificationChannel: "sms",
					notificationTarget: "+15551234567",
				},
			},
			env,
		);

		expect(mocks.getProviderApiKeyForSettings).toHaveBeenCalledWith({
			userId: 42,
			providerId: "aws-sms",
			providerSettingsId: "provider-row-2",
		});
		expect(mocks.providerSend).toHaveBeenCalledWith({
			to: "+15551234567",
			body: "Nutrition summary attached.",
			mediaUrls: ["s3://polychat-mms/generated/nutrition-image.png"],
		});
	});
});
