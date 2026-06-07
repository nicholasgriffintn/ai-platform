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
	const context = { env, user } as any;
	const invocation: RecipeInvocationResponse = {
		recipeId: "notion-action-log",
		installationId: "installation-1",
		status: "ready",
		conversationStarter: "Run this installed Notion recipe.",
		messageUrl: "/?query=Run",
		missingConnections: [],
		enabledTools: ["use_recipe_connector"],
		allowedConnectorProviders: ["notion"],
		configuration: { target: "Action log" },
	};

	beforeEach(() => {
		vi.clearAllMocks();
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
					recipe: {
						id: "notion-action-log",
						installationId: "installation-1",
						allowedConnectorProviders: ["notion"],
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
});
