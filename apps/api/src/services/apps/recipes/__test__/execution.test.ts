import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeInvocationResponse } from "@assistant/schemas";
import type { IEnv, IUser } from "~/types";

const mocks = vi.hoisted(() => ({
	handleCreateChatCompletions: vi.fn(),
	generateId: vi.fn(),
}));

vi.mock("~/services/completions/createChatCompletions", () => ({
	handleCreateChatCompletions: mocks.handleCreateChatCompletions,
}));

vi.mock("~/utils/id", () => ({
	generateId: mocks.generateId,
}));

import { executeRecipeInvocationChat } from "../execution";

describe("executeRecipeInvocationChat", () => {
	const env = { DB: {}, AI: {} } as unknown as IEnv;
	const user = {
		id: 42,
		email: "test@example.com",
		plan_id: "pro",
	} as IUser;
	const updateConversation = vi.fn();
	const context = {
		env,
		user,
		repositories: {
			conversations: {
				updateConversation,
			},
		},
	} as any;
	const invocation: RecipeInvocationResponse = {
		recipeId: "notion-action-log",
		recipeTitle: "Notion Action Log",
		installationId: "installation-1",
		channel: "scheduled",
		status: "ready",
		conversationStarter: "Run this installed Notion recipe.",
		messageUrl: "/?query=Run",
		missingConnections: [],
		enabledTools: ["use_recipe_connector"],
		allowedConnectorProviders: ["notion"],
		allowedConnectorOperations: {
			notion: ["search", "append_block_children"],
		},
		configuration: { target: "Action log" },
	};

	beforeEach(() => {
		vi.clearAllMocks();
		updateConversation.mockResolvedValue({});
		mocks.generateId.mockReturnValue("generated-id");
		mocks.handleCreateChatCompletions.mockResolvedValue({
			id: "recipe_generated-id",
			log_id: "log-1",
			object: "chat.completion",
			created: 1,
			choices: [],
		});
	});

	it("runs the invocation through a stored non-streaming chat completion", async () => {
		const result = await executeRecipeInvocationChat({ env, context, user, invocation });

		expect(result.conversationId).toBe("recipe_generated-id");
		expect(mocks.handleCreateChatCompletions).toHaveBeenCalledWith({
			env,
			context,
			user,
			request: expect.objectContaining({
				completion_id: "recipe_generated-id",
				model: "deepseek-chat",
				mode: "agent",
				stream: false,
				store: true,
				enabled_tools: ["use_recipe_connector"],
				approved_tools: ["use_recipe_connector"],
				tool_choice: "auto",
				max_steps: 8,
				options: expect.objectContaining({
					agent: {
						minToolCalls: 1,
					},
					recipe: {
						id: "notion-action-log",
						installationId: "installation-1",
						channel: "scheduled",
						allowedConnectorProviders: ["notion"],
						allowedConnectorOperations: {
							notion: ["search", "append_block_children"],
						},
						configuration: { target: "Action log" },
					},
				}),
				messages: [
					{
						role: "user",
						content: "Run this installed Notion recipe.",
					},
				],
			}),
		});
	});

	it("titles generated recipe conversations so scheduled runs are visible in history", async () => {
		const result = await executeRecipeInvocationChat({
			env,
			context,
			user,
			invocation,
		});

		expect(result.conversationId).toBe("recipe_generated-id");
		expect(updateConversation).toHaveBeenCalledWith("recipe_generated-id", {
			title: "Recipe: Notion Action Log",
		});
	});

	it("titles caller-provided recipe conversations when requested", async () => {
		const result = await executeRecipeInvocationChat({
			env,
			context,
			user,
			invocation,
			conversationId: "recipe_task-1",
			titleConversation: true,
		});

		expect(result.conversationId).toBe("recipe_task-1");
		expect(updateConversation).toHaveBeenCalledWith("recipe_task-1", {
			title: "Recipe: Notion Action Log",
		});
	});

	it("passes SMS context into chat completion options for text-message recipe runs", async () => {
		await executeRecipeInvocationChat({
			env,
			context,
			user,
			invocation,
			sms: {
				from: "+15551234567",
				to: "+15557654321",
			},
		});

		expect(mocks.handleCreateChatCompletions).toHaveBeenCalledWith({
			env,
			context,
			user,
			request: expect.objectContaining({
				options: expect.objectContaining({
					source: "sms",
					sms: {
						enabled: true,
						from: "+15551234567",
						to: "+15557654321",
					},
				}),
			}),
		});
	});

	it("can run a recipe inside an existing SMS conversation window", async () => {
		const result = await executeRecipeInvocationChat({
			env,
			context,
			user,
			invocation,
			conversationId: "sms_conversation",
			priorMessages: [
				{
					id: "message-1",
					role: "user",
					content: "run my action log recipe",
				},
			],
			sms: {
				from: "+15551234567",
				to: "+15557654321",
			},
		});

		expect(result.conversationId).toBe("sms_conversation");
		expect(mocks.generateId).not.toHaveBeenCalled();
		expect(mocks.handleCreateChatCompletions).toHaveBeenCalledWith({
			env,
			context,
			user,
			request: expect.objectContaining({
				completion_id: "sms_conversation",
				messages: [
					{
						id: "message-1",
						role: "user",
						content: "run my action log recipe",
					},
					{
						role: "user",
						content: "Run this installed Notion recipe.",
					},
				],
				options: expect.objectContaining({
					source: "sms",
					sms: {
						enabled: true,
						from: "+15551234567",
						to: "+15557654321",
					},
				}),
			}),
		});
	});
});
