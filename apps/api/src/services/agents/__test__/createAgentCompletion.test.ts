import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAgentCompletion } from "../createAgentCompletion";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import type { ChatCompletionParameters, IEnv } from "~/types";

vi.mock("~/lib/providers/models", () => ({
	getModelConfig: vi.fn(async () => ({ provider: "openai" })),
}));

vi.mock("~/lib/chat/tools", () => ({
	formatToolCalls: vi.fn(() => []),
}));

vi.mock("~/services/completions/createChatCompletions", () => ({
	handleCreateChatCompletions: vi.fn(async (req) => req),
}));

describe("createAgentCompletion", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("uses request enabled_tools even when agent enabled_tools exists", async () => {
		const agent = {
			id: "agent_123",
			user_id: 1,
			model: null,
			temperature: null,
			max_steps: null,
			system_prompt: null,
			few_shot_examples: null,
			enabled_tools: ["web_search", "get_weather"],
			servers: null,
			team_role: null,
		};

		const context = {
			env: {} as IEnv,
			ensureDatabase: vi.fn(),
			repositories: {
				agents: {
					getAgentById: vi.fn(async () => agent),
				},
			},
		} as any;

		const body = {
			messages: [{ role: "user", content: "hi" }],
			model: "gpt-4",
			enabled_tools: ["create_image"],
		} as ChatCompletionParameters;

		await createAgentCompletion({
			env: {} as IEnv,
			context,
			body,
			agentId: agent.id,
			user: { id: 1 } as any,
			anonymousUser: null,
		});

		expect(handleCreateChatCompletions).toHaveBeenCalledWith(
			expect.objectContaining({
				request: expect.objectContaining({
					enabled_tools: ["create_image"],
				}),
			}),
		);
	});

	it("uses request enabled_tools when agent enabled_tools is unset", async () => {
		const agent = {
			id: "agent_789",
			user_id: 1,
			model: null,
			temperature: null,
			max_steps: null,
			system_prompt: null,
			few_shot_examples: null,
			enabled_tools: null,
			servers: null,
			team_role: null,
		};

		const context = {
			env: {} as IEnv,
			ensureDatabase: vi.fn(),
			repositories: {
				agents: {
					getAgentById: vi.fn(async () => agent),
				},
			},
		} as any;

		const body = {
			messages: [{ role: "user", content: "hi" }],
			model: "gpt-4",
			enabled_tools: ["create_image"],
		} as ChatCompletionParameters;

		await createAgentCompletion({
			env: {} as IEnv,
			context,
			body,
			agentId: agent.id,
			user: { id: 1 } as any,
			anonymousUser: null,
		});

		expect(handleCreateChatCompletions).toHaveBeenCalledWith(
			expect.objectContaining({
				request: expect.objectContaining({
					enabled_tools: ["create_image"],
				}),
			}),
		);
	});
});
