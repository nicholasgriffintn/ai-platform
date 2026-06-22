import { describe, expect, it } from "vitest";

import { createAgentProviderIO } from "../provider-io";
import { AssistantError, ErrorType } from "~/utils/errors";

describe("agent provider IO", () => {
	it("projects runtime agent messages into provider chat messages", () => {
		const providerIO = createAgentProviderIO();

		expect(
			providerIO.providerMessages([
				{
					role: "assistant",
					content: [{ type: "text", text: "Use this context" }],
					tool_call_id: "tool-1",
					tool_call_arguments: { query: "weather" },
					status: "success",
				},
				{
					role: "user",
					content: [{ arbitrary: "shape" }],
				},
			]),
		).toEqual([
			{
				role: "assistant",
				content: [{ type: "text", text: "Use this context" }],
				tool_call_id: "tool-1",
				tool_call_arguments: { query: "weather" },
				status: "success",
			},
			{
				role: "user",
				content: JSON.stringify([{ arbitrary: "shape" }]),
			},
		]);
	});

	it("interprets provider model responses and tool calls", () => {
		const providerIO = createAgentProviderIO();

		const response = providerIO.modelResponse({
			response: "Looking that up.",
			tool_calls: [
				{
					id: "call-1",
					function: {
						name: "get_weather",
						arguments: '{"location":"London"}',
					},
				},
				{
					id: "call-ignored",
					function: null,
				},
			],
			citations: ["https://example.com", 123],
			usage: { total_tokens: 12 },
			usageMetadata: { totalTokenCount: 12 },
			refusal: null,
		});

		expect(response).toEqual({
			response: "Looking that up.",
			tool_calls: [
				{
					id: "call-1",
					function: {
						name: "get_weather",
						arguments: '{"location":"London"}',
					},
				},
			],
			citations: ["https://example.com"],
			data: undefined,
			log_id: undefined,
			usage: { total_tokens: 12 },
			usageMetadata: { totalTokenCount: 12 },
			status: undefined,
			refusal: null,
			annotations: undefined,
		});
		expect(providerIO.toolCallInvocations(response.tool_calls ?? [])).toEqual([
			{
				id: "call-1",
				name: "get_weather",
				arguments: '{"location":"London"}',
				raw: response.tool_calls?.[0],
			},
		]);
	});

	it("round-trips agent tool invocations back into provider tool call payloads", () => {
		const providerIO = createAgentProviderIO({ createId: () => "generated-id" });

		expect(
			providerIO.providerToolCalls([
				{
					id: "raw-call",
					name: "raw_tool",
					raw: {
						id: "raw-call",
						type: "function",
						function: {
							name: "raw_tool",
							arguments: "{}",
						},
					},
				},
				{
					name: "synthetic_tool",
					arguments: { value: 1 },
				},
			]),
		).toEqual([
			{
				id: "raw-call",
				type: "function",
				function: {
					name: "raw_tool",
					arguments: "{}",
				},
			},
			{
				id: "generated-id",
				type: "function",
				function: {
					name: "synthetic_tool",
					arguments: JSON.stringify({ value: 1 }),
				},
			},
		]);
	});

	it("rejects invalid initial messages and provider responses", () => {
		const providerIO = createAgentProviderIO();

		expect(() => providerIO.initialMessages([])).toThrow(
			new AssistantError("Agent mode requires at least one message", ErrorType.PARAMS_ERROR),
		);
		expect(() => providerIO.modelResponse(null)).toThrow(
			new AssistantError("Provider returned an invalid response shape", ErrorType.PROVIDER_ERROR),
		);
	});
});
