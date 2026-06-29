import { describe, expect, it } from "vitest";

import type { ChatCompletionRequestBody } from "@assistant/schemas";
import { prepareAgentCompletionRequest } from "../completion-request";

describe("agent completion request preparation", () => {
	it("prepares the strict chat completion request for agent execution", () => {
		const body: ChatCompletionRequestBody = {
			messages: [{ role: "user", content: "" }],
			model: "gpt-4",
			provider: "openai",
			platform: "obsidian",
			store: true,
			stop: "END",
			tool_choice: { type: "function", function: { name: "lookup" } },
		};
		const request = prepareAgentCompletionRequest({
			agent: {
				id: "agent-1",
				model: null,
				temperature: null,
				max_steps: null,
			},
			body,
			modelProvider: "openai",
			formattedTools: [{ type: "function", function: { name: "lookup" } }],
			systemPrompt: "Use the agent prompt.",
		});

		expect(request).toMatchObject({
			messages: [{ role: "user", content: "" }],
			system_prompt: "Use the agent prompt.",
			model: "gpt-4",
			provider: "openai",
			tools: [{ type: "function", function: { name: "lookup" } }],
			stream: false,
			mode: "agent",
			max_steps: 20,
			temperature: 0.8,
			current_agent_id: "agent-1",
			platform: "api",
			stop: ["END"],
			tool_choice: { type: "function", function: { name: "lookup" } },
		});
	});

	it("preserves explicit zero temperature from the agent", () => {
		const body: ChatCompletionRequestBody = {
			messages: [{ role: "user", content: "hi" }],
			model: "gpt-4",
			store: true,
			temperature: 0.9,
		};
		const request = prepareAgentCompletionRequest({
			agent: {
				id: "agent-1",
				model: null,
				temperature: "0",
				max_steps: null,
			},
			body,
			modelProvider: "openai",
			formattedTools: [],
			systemPrompt: "",
		});

		expect(request.temperature).toBe(0);
	});
});
