import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createServiceContext: vi.fn(),
	getMessagingProviderFromStoredCredential: vi.fn(),
	resolveInstalledAssistantRecipe: vi.fn(),
	invokeAssistantRecipe: vi.fn(),
	executeRecipeInvocationChat: vi.fn(),
	handleCreateChatCompletions: vi.fn(),
	conversationGetInstance: vi.fn(),
	conversationGet: vi.fn(),
	conversationArchiveMessages: vi.fn(),
	providerSend: vi.fn(),
	providerParseIncoming: vi.fn(),
}));

vi.mock("~/lib/conversationManager", () => ({
	ConversationManager: {
		getInstance: mocks.conversationGetInstance,
	},
}));

vi.mock("~/lib/context/serviceContext", () => ({
	createServiceContext: mocks.createServiceContext,
}));

vi.mock("~/lib/providers/capabilities/messaging", async (importOriginal) => {
	const original = await importOriginal<typeof import("~/lib/providers/capabilities/messaging")>();
	return {
		...original,
	};
});

vi.mock("~/lib/providers/capabilities/messaging/delivery", async (importOriginal) => {
	const original =
		await importOriginal<typeof import("~/lib/providers/capabilities/messaging/delivery")>();
	return {
		...original,
		getMessagingProviderFromStoredCredential: mocks.getMessagingProviderFromStoredCredential,
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

function createMockContext(options: { providerId?: string; providerSettingsId?: string } = {}) {
	const providerId = options.providerId ?? "twilio-sms";
	const providerSettingsId = options.providerSettingsId ?? "provider-row-1";
	return {
		env: { DB: {}, API_BASE_URL: "https://api.polychat.test" },
		req: {
			param: vi.fn((key: string) =>
				key === "providerId" ? providerId : key === "providerSettingsId" ? providerSettingsId : "",
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
			getProviderApiKeyForSettings: vi.fn(async () => "encrypted-config"),
			getUserProviderSettings: vi.fn(async () => [
				{
					id: "provider-row-1",
					provider_id: "twilio-sms",
					type: "messaging",
					enabled: true,
					hasApiKey: true,
				},
			]),
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
		database: {},
		repositories,
		requestCache: new Map(),
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
		mocks.getMessagingProviderFromStoredCredential.mockReturnValue({
			parseIncoming: mocks.providerParseIncoming,
			send: mocks.providerSend,
		});
		mocks.resolveInstalledAssistantRecipe.mockResolvedValue({
			status: "not_found",
			candidates: [],
		});
		mocks.handleCreateChatCompletions.mockResolvedValue({
			choices: [{ message: { content: "chat reply" } }],
		});
		mocks.conversationGet.mockResolvedValue([]);
		mocks.conversationArchiveMessages.mockResolvedValue(undefined);
		mocks.conversationGetInstance.mockReturnValue({
			get: mocks.conversationGet,
			archiveMessages: mocks.conversationArchiveMessages,
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

	it("responds with an explicitly labelled job id without invoking chat", async () => {
		const taskId = "3f93b640-23d4-4279-b8d4-2fd5d6ca6a20";
		const getTaskById = vi.fn(async () => ({
			id: taskId,
			user_id: 42,
			task_type: "recipe_execution",
			status: "completed",
			created_at: "2026-06-07T10:00:00.000Z",
		}));
		const repositories = createRepositories({
			tasks: {
				getTaskById,
				getTasksByUserId: vi.fn(async () => []),
			},
		});
		prepareServiceContext(repositories);
		mocks.providerParseIncoming.mockResolvedValue({
			kind: "message",
			from: "+15551234567",
			to: "+15557654321",
			body: `job #${taskId}`,
		});

		await handleSmsAssistantWebhook(createMockContext());

		expect(getTaskById).toHaveBeenCalledWith(taskId);
		expect(mocks.handleCreateChatCompletions).not.toHaveBeenCalled();
		expect(mocks.providerSend).toHaveBeenCalledWith({
			to: "+15551234567",
			body: expect.stringContaining(`recipe_execution ${taskId}: completed`),
		});
	});

	it("responds when a generated task id is sent directly", async () => {
		const taskId = "3f93b640-23d4-4279-b8d4-2fd5d6ca6a20";
		const getTaskById = vi.fn(async () => ({
			id: taskId,
			user_id: 42,
			task_type: "recipe_execution",
			status: "running",
			created_at: "2026-06-07T10:00:00.000Z",
		}));
		const repositories = createRepositories({
			tasks: {
				getTaskById,
				getTasksByUserId: vi.fn(async () => []),
			},
		});
		prepareServiceContext(repositories);
		mocks.providerParseIncoming.mockResolvedValue({
			kind: "message",
			from: "+15551234567",
			to: "+15557654321",
			body: taskId,
		});

		await handleSmsAssistantWebhook(createMockContext());

		expect(getTaskById).toHaveBeenCalledWith(taskId);
		expect(mocks.handleCreateChatCompletions).not.toHaveBeenCalled();
		expect(mocks.providerSend).toHaveBeenCalledWith({
			to: "+15551234567",
			body: expect.stringContaining(`recipe_execution ${taskId}: running`),
		});
	});

	it("does not intercept task-management messages as task status requests", async () => {
		const getTasksByUserId = vi.fn(async () => []);
		const repositories = createRepositories({
			tasks: {
				getTaskById: vi.fn(),
				getTasksByUserId,
			},
		});
		prepareServiceContext(repositories);
		mocks.providerParseIncoming.mockResolvedValue({
			kind: "message",
			from: "+15551234567",
			to: "+15557654321",
			body: "add a task to Todoist tomorrow",
		});

		await handleSmsAssistantWebhook(createMockContext());

		expect(getTasksByUserId).not.toHaveBeenCalled();
		expect(mocks.handleCreateChatCompletions).toHaveBeenCalledWith(
			expect.objectContaining({
				request: expect.objectContaining({
					messages: [{ role: "user", content: "add a task to Todoist tomorrow" }],
				}),
			}),
		);
	});

	it("executes a matched installed recipe", async () => {
		const repositories = createRepositories();
		prepareServiceContext(repositories);
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

		expect(repositories.userSettings.getProviderApiKeyForSettings).toHaveBeenCalledWith({
			userId: 42,
			providerId: "twilio-sms",
			providerSettingsId: "provider-row-1",
		});
		expect(mocks.invokeAssistantRecipe).toHaveBeenCalledWith("daily-weather", {
			context: expect.any(Object),
			userId: 42,
			channel: "sms",
			input: "run daily weather",
			requireInstalled: true,
		});
		expect(mocks.executeRecipeInvocationChat).toHaveBeenCalledWith({
			env: expect.any(Object),
			context: expect.any(Object),
			user: testUser,
			invocation: expect.objectContaining({
				recipeId: "daily-weather",
			}),
			conversationId: expect.stringMatching(/^sms_[a-f0-9]{40}$/),
			priorMessages: [{ role: "user", content: "run daily weather" }],
			sms: {
				from: "+15551234567",
				to: "+15557654321",
			},
		});
		expect(mocks.providerSend).toHaveBeenCalledWith({
			to: "+15551234567",
			body: "Weather summary",
		});
	});

	it("passes inbound MMS images into matched recipe context", async () => {
		prepareServiceContext();
		mocks.providerParseIncoming.mockResolvedValue({
			kind: "message",
			from: "+15551234567",
			to: "+15557654321",
			body: "run photo nutrition",
			media: [
				{
					url: "https://media.twilio.com/image",
					mimeType: "image/jpeg",
				},
			],
			mediaUrls: ["https://media.twilio.com/image"],
		});
		mocks.resolveInstalledAssistantRecipe.mockResolvedValue({
			status: "matched",
			recipe: { id: "photo-nutrition-check" },
			candidates: [],
		});
		mocks.invokeAssistantRecipe.mockResolvedValue({
			recipeId: "photo-nutrition-check",
			status: "ready",
			enabledTools: [],
			conversationStarter: "Photo nutrition recipe",
			missingConnections: [],
			configuration: {},
		});
		mocks.executeRecipeInvocationChat.mockResolvedValue({
			conversationId: "recipe-conversation",
			response: { choices: [{ message: { content: "Nutrition summary" } }] },
		});

		await handleSmsAssistantWebhook(createMockContext());

		expect(mocks.executeRecipeInvocationChat).toHaveBeenCalledWith(
			expect.objectContaining({
				priorMessages: [
					{
						role: "user",
						content: [
							{ type: "text", text: "run photo nutrition" },
							{
								type: "image_url",
								image_url: { url: "https://media.twilio.com/image" },
							},
						],
					},
				],
			}),
		);
	});

	it("sends media outputs from SMS-triggered recipes", async () => {
		prepareServiceContext();
		mocks.providerParseIncoming.mockResolvedValue({
			kind: "message",
			from: "+15551234567",
			to: "+15557654321",
			body: "run photo nutrition",
		});
		mocks.resolveInstalledAssistantRecipe.mockResolvedValue({
			status: "matched",
			recipe: { id: "photo-nutrition-check" },
			candidates: [],
		});
		mocks.invokeAssistantRecipe.mockResolvedValue({
			recipeId: "photo-nutrition-check",
			status: "ready",
			enabledTools: [],
			conversationStarter: "Photo nutrition recipe",
			missingConnections: [],
			configuration: {},
		});
		mocks.executeRecipeInvocationChat.mockResolvedValue({
			conversationId: "recipe-conversation",
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
						},
					},
				],
			},
		});

		await handleSmsAssistantWebhook(createMockContext());

		expect(mocks.providerSend).toHaveBeenCalledWith({
			to: "+15551234567",
			body: "Nutrition summary attached.",
			mediaUrls: ["https://api.polychat.test/assets/nutrition-image"],
		});
	});

	it("sends media outputs from SMS-triggered recipe tool result choices", async () => {
		prepareServiceContext();
		mocks.providerParseIncoming.mockResolvedValue({
			kind: "message",
			from: "+15551234567",
			to: "+15557654321",
			body: "make a qr code for https://polychat.app",
		});
		mocks.resolveInstalledAssistantRecipe.mockResolvedValue({
			status: "matched",
			recipe: { id: "quick-qr-generator" },
			candidates: [],
		});
		mocks.invokeAssistantRecipe.mockResolvedValue({
			recipeId: "quick-qr-generator",
			status: "ready",
			enabledTools: ["create_qr_code"],
			conversationStarter: "Quick QR recipe",
			missingConnections: [],
			configuration: {},
		});
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

		await handleSmsAssistantWebhook(createMockContext());

		expect(mocks.providerSend).toHaveBeenCalledWith({
			to: "+15551234567",
			body: "QR code ready.",
			mediaUrls: [
				"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https%3A%2F%2Fpolychat.app",
			],
		});
	});

	it("normalises AWS SMS-triggered recipe replies to the deliverable S3 media URL", async () => {
		const repositories = createRepositories({
			userSettings: {
				getProviderSettingsById: vi.fn(async () => ({
					id: "aws-row",
					user_id: 42,
					provider_id: "aws-sms",
					enabled: 1,
				})),
				getProviderApiKey: vi.fn(async () => "encrypted-config"),
				getProviderApiKeyForSettings: vi.fn(async () => "encrypted-config"),
				getUserProviderSettings: vi.fn(async () => [
					{
						id: "aws-row",
						provider_id: "aws-sms",
						type: "messaging",
						enabled: true,
						hasApiKey: true,
						configurationValues: {
							mediaBucket: "polychat-mms-media",
						},
					},
				]),
			},
		});
		prepareServiceContext(repositories);
		mocks.providerParseIncoming.mockResolvedValue({
			kind: "message",
			from: "+15551234567",
			to: "arn:aws:sms-voice:us-east-1:123456789012:rcs-agent/rcs-a1b2c3d4",
			body: "run photo nutrition",
		});
		mocks.resolveInstalledAssistantRecipe.mockResolvedValue({
			status: "matched",
			recipe: { id: "photo-nutrition-check" },
			candidates: [],
		});
		mocks.invokeAssistantRecipe.mockResolvedValue({
			recipeId: "photo-nutrition-check",
			status: "ready",
			enabledTools: [],
			conversationStarter: "Photo nutrition recipe",
			missingConnections: [],
			configuration: {},
		});
		mocks.executeRecipeInvocationChat.mockResolvedValue({
			conversationId: "recipe-conversation",
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
									{ url: "https://api.polychat.test/assets/nutrition-image" },
									{ url: "s3://polychat-mms/generated/nutrition-image.png" },
								],
							},
						},
					},
				],
			},
		});

		await handleSmsAssistantWebhook(
			createMockContext({ providerId: "aws-sms", providerSettingsId: "aws-row" }),
		);

		expect(repositories.userSettings.getUserProviderSettings).toHaveBeenCalledWith(42);
		expect(mocks.providerSend).toHaveBeenCalledWith({
			to: "+15551234567",
			body: "Nutrition summary attached.",
			mediaUrls: ["s3://polychat-mms/generated/nutrition-image.png"],
		});
	});

	it("sends AWS SMS-triggered recipe replies as text when media is not deliverable", async () => {
		const repositories = createRepositories({
			userSettings: {
				getProviderSettingsById: vi.fn(async () => ({
					id: "aws-row",
					user_id: 42,
					provider_id: "aws-sms",
					enabled: 1,
				})),
				getProviderApiKey: vi.fn(async () => "encrypted-config"),
				getProviderApiKeyForSettings: vi.fn(async () => "encrypted-config"),
				getUserProviderSettings: vi.fn(async () => [
					{
						id: "aws-row",
						provider_id: "aws-sms",
						type: "messaging",
						enabled: true,
						hasApiKey: true,
					},
				]),
			},
		});
		prepareServiceContext(repositories);
		mocks.providerParseIncoming.mockResolvedValue({
			kind: "message",
			from: "+15551234567",
			to: "arn:aws:sms-voice:us-east-1:123456789012:rcs-agent/rcs-a1b2c3d4",
			body: "run photo nutrition",
		});
		mocks.resolveInstalledAssistantRecipe.mockResolvedValue({
			status: "matched",
			recipe: { id: "photo-nutrition-check" },
			candidates: [],
		});
		mocks.invokeAssistantRecipe.mockResolvedValue({
			recipeId: "photo-nutrition-check",
			status: "ready",
			enabledTools: [],
			conversationStarter: "Photo nutrition recipe",
			missingConnections: [],
			configuration: {},
		});
		mocks.executeRecipeInvocationChat.mockResolvedValue({
			conversationId: "recipe-conversation",
			response: {
				choices: [
					{
						message: {
							content: [
								{ type: "text", text: "Nutrition summary attached." },
								{
									type: "image_url",
									image_url: {
										url: "https://cdn.example.com/nutrition-image.png",
									},
								},
							],
						},
					},
				],
			},
		});

		await handleSmsAssistantWebhook(
			createMockContext({ providerId: "aws-sms", providerSettingsId: "aws-row" }),
		);

		expect(mocks.providerSend).toHaveBeenCalledWith({
			to: "+15551234567",
			body: "Nutrition summary attached.",
		});
	});

	it("runs matched recipes in the bounded SMS conversation window", async () => {
		prepareServiceContext();
		const storedMessages = [
			{ id: "message-1", role: "user", content: "hello" },
			{ id: "message-2", role: "assistant", content: "chat reply" },
		];
		mocks.conversationGet.mockResolvedValue(storedMessages);
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
			conversationId: "sms_conversation",
			response: { choices: [{ message: { content: "Weather summary" } }] },
		});

		await handleSmsAssistantWebhook(createMockContext());

		expect(mocks.executeRecipeInvocationChat).toHaveBeenCalledWith(
			expect.objectContaining({
				conversationId: expect.stringMatching(/^sms_[a-f0-9]{40}$/),
				priorMessages: [...storedMessages, { role: "user", content: "run daily weather" }],
				sms: {
					from: "+15551234567",
					to: "+15557654321",
				},
			}),
		);
		expect(mocks.handleCreateChatCompletions).not.toHaveBeenCalled();
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
					completion_id: expect.stringMatching(/^sms_[a-f0-9]{40}$/),
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

	it("separates SMS conversations by inbound destination identity", async () => {
		prepareServiceContext();
		mocks.providerParseIncoming
			.mockResolvedValueOnce({
				kind: "message",
				from: "+15551234567",
				to: "+15557654321",
				body: "hello first number",
			})
			.mockResolvedValueOnce({
				kind: "message",
				from: "+15551234567",
				to: "arn:aws:sms-voice:us-east-1:123456789012:rcs-agent/rcs-a1b2c3d4",
				body: "hello rcs agent",
			});

		await handleSmsAssistantWebhook(createMockContext());
		await handleSmsAssistantWebhook(createMockContext());

		const firstCompletionId =
			mocks.handleCreateChatCompletions.mock.calls[0]?.[0].request.completion_id;
		const secondCompletionId =
			mocks.handleCreateChatCompletions.mock.calls[1]?.[0].request.completion_id;
		expect(firstCompletionId).toMatch(/^sms_[a-f0-9]{40}$/);
		expect(secondCompletionId).toMatch(/^sms_[a-f0-9]{40}$/);
		expect(firstCompletionId).not.toBe(secondCompletionId);
	});

	it("passes inbound MMS images into bounded SMS chat fallback", async () => {
		prepareServiceContext();
		mocks.providerParseIncoming.mockResolvedValue({
			kind: "message",
			from: "+15551234567",
			to: "+15557654321",
			body: "what is this?",
			media: [
				{
					url: "https://media.twilio.com/image",
					mimeType: "image/png",
				},
			],
			mediaUrls: ["https://media.twilio.com/image"],
		});

		await handleSmsAssistantWebhook(createMockContext());

		expect(mocks.handleCreateChatCompletions).toHaveBeenCalledWith(
			expect.objectContaining({
				request: expect.objectContaining({
					messages: [
						{
							role: "user",
							content: [
								{ type: "text", text: "what is this?" },
								{
									type: "image_url",
									image_url: { url: "https://media.twilio.com/image" },
								},
							],
						},
					],
				}),
			}),
		);
	});

	it("bounds stored SMS chat history before sending fallback chat context", async () => {
		prepareServiceContext();
		const storedMessages = Array.from({ length: 10 }, (_, index) => ({
			id: `message-${index}`,
			role: index % 2 === 0 ? "user" : "assistant",
			content: `stored ${index}`,
		}));
		mocks.conversationGet.mockResolvedValue(storedMessages);
		mocks.providerParseIncoming.mockResolvedValue({
			kind: "message",
			from: "+15551234567",
			to: "+15557654321",
			body: "continue",
		});

		await handleSmsAssistantWebhook(createMockContext());

		const chatRequest = mocks.handleCreateChatCompletions.mock.calls[0]?.[0].request;
		expect(mocks.conversationArchiveMessages).toHaveBeenCalledWith(chatRequest.completion_id, [
			"message-0",
			"message-1",
			"message-2",
		]);
		expect(chatRequest.messages).toEqual([
			...storedMessages.slice(3),
			{ role: "user", content: "continue" },
		]);
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
