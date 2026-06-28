import { describe, expect, it } from "vitest";
import { buildAgentTraceEntries } from "~/lib/agent-trace";
import type { Message } from "~/types";

describe("agent trace entries", () => {
	it("derives model, tool, approval, error, and final synthesis steps from messages", () => {
		const messages: Message[] = [
			{
				id: "user-1",
				role: "user",
				content: "Check PostHog and summarise.",
				created: 1000,
			},
			{
				id: "assistant-1",
				role: "assistant",
				content: "",
				model: "gpt-5.5",
				platform: "openai",
				created: 1500,
				usage: {
					prompt_tokens: 120,
					completion_tokens: 40,
					total_tokens: 160,
					cost_usd: 0.012,
				},
				tool_calls: [
					{
						id: "call-1",
						type: "function",
						function: {
							name: "connector_posthog_query",
							arguments: { params: { query: "select * from events limit 5" } },
						},
					},
				],
			},
			{
				id: "tool-1",
				role: "tool",
				content: "Approval required",
				name: "connector_posthog_query",
				tool_call_id: "call-1",
				status: "error",
				data: {
					approvalRequired: true,
					approval: {
						reason: "Tool requires approval in build mode",
					},
				},
			},
			{
				id: "assistant-2",
				role: "assistant",
				content: "PostHog returned five recent events.",
				model: "gpt-5.5",
				platform: "openai",
				created: 2500,
				data: {
					retryAttempt: 2,
					error: "Provider warning: partial result",
				},
			},
		];

		expect(buildAgentTraceEntries(messages)).toEqual([
			expect.objectContaining({
				id: "user:user-1",
				type: "user_turn",
				label: "Check PostHog and summarise.",
			}),
			expect.objectContaining({
				id: "model:user-1:assistant-1",
				type: "model_call",
				label: "gpt-5.5",
				provider: "openai",
				latencyMs: 500,
				usage: {
					inputTokens: 120,
					outputTokens: 40,
					totalTokens: 160,
					costUsd: 0.012,
				},
			}),
			expect.objectContaining({
				id: "tool-call:assistant-1:call-1",
				type: "tool_call",
				label: "connector_posthog_query",
			}),
			expect.objectContaining({
				id: "tool-result:tool-1",
				type: "tool_result",
				label: "connector_posthog_query",
				status: "error",
			}),
			expect.objectContaining({
				id: "approval:tool-1",
				type: "approval",
				label: "connector_posthog_query",
				status: "pending",
			}),
			expect.objectContaining({
				id: "model:tool-1:assistant-2",
				type: "model_call",
				label: "gpt-5.5",
				provider: "openai",
			}),
			expect.objectContaining({
				id: "assistant-response:assistant-2",
				type: "assistant_response",
				label: "PostHog returned five recent events.",
				provider: "openai",
			}),
			expect.objectContaining({
				id: "retry:assistant-2",
				type: "retry",
				label: "Attempt 2",
				provider: "openai",
			}),
			expect.objectContaining({
				id: "provider-error:assistant-2",
				type: "provider_error",
				label: "Provider warning: partial result",
			}),
		]);
	});

	it("traces ordinary multi-turn conversations instead of only model calls", () => {
		const messages: Message[] = [
			{
				id: "user-1",
				role: "user",
				content: "hi",
				created: 1000,
			},
			{
				id: "assistant-1",
				role: "assistant",
				content: "Hi! How can I help today?",
				model: "gpt-5.4-mini",
				platform: "web",
				created: 3900,
				usage: {
					total_tokens: 2135,
				},
			},
			{
				id: "user-2",
				role: "user",
				content: "what can you do?",
				created: 5000,
			},
			{
				id: "assistant-2",
				role: "assistant",
				content: "I can help with a wide range of day-to-day tasks.",
				model: "gpt-5.4-nano",
				platform: "web",
				created: 10800,
				usage: {
					total_tokens: 2365,
				},
			},
		];

		expect(buildAgentTraceEntries(messages).map(({ type, label }) => ({ type, label }))).toEqual([
			{ type: "user_turn", label: "hi" },
			{ type: "model_call", label: "gpt-5.4-mini" },
			{ type: "assistant_response", label: "Hi! How can I help today?" },
			{ type: "user_turn", label: "what can you do?" },
			{ type: "model_call", label: "gpt-5.4-nano" },
			{
				type: "assistant_response",
				label: "I can help with a wide range of day-to-day tasks.",
			},
		]);
	});

	it("deduplicates tool calls that are represented in both tool_calls and parts", () => {
		const messages: Message[] = [
			{
				id: "assistant-1",
				role: "assistant",
				content: "Searching...",
				tool_calls: [
					{
						id: "call_00_search",
						type: "function",
						function: {
							name: "web_search",
							arguments: '{"query":"Polychat"}',
						},
					},
					{
						id: "call_00_search",
						type: "function",
						function: {
							name: "web_search",
							arguments: {
								query: "Polychat",
							},
						},
					},
				],
				parts: [
					{
						type: "tool_use",
						name: "web_search",
						toolCallId: "call_00_search",
						input: {
							query: "Polychat",
						},
					},
				],
			},
		];

		expect(buildAgentTraceEntries(messages).filter((entry) => entry.type === "tool_call")).toEqual([
			expect.objectContaining({
				id: "tool-call:assistant-1:call_00_search",
				label: "web_search",
			}),
		]);
	});

	it("keeps trace ids unique when replayed messages reuse provider tool call ids", () => {
		const messages: Message[] = [
			{
				id: "assistant-1",
				role: "assistant",
				content: "Searching...",
				tool_calls: [
					{
						id: "call_00_search",
						type: "function",
						function: {
							name: "web_search",
							arguments: '{"query":"Polychat"}',
						},
					},
				],
			},
			{
				id: "assistant-2",
				role: "assistant",
				content: "Searching again...",
				tool_calls: [
					{
						id: "call_00_search",
						type: "function",
						function: {
							name: "web_search",
							arguments: '{"query":"Polychat"}',
						},
					},
				],
			},
		];

		const ids = buildAgentTraceEntries(messages).map((entry) => entry.id);

		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toContain("tool-call:assistant-1:call_00_search");
		expect(ids).toContain("tool-call:assistant-2:call_00_search");
	});
});
