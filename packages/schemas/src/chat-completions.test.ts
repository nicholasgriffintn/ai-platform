import { describe, expect, it } from "vitest";

import {
	createChatCompletionsJsonSchema,
	createChatCompletionsResponseSchema,
} from "./chat-completions";

const messages = [{ role: "user" as const, content: "Hello" }];

describe("chat completions schema", () => {
	it("accepts automatic router mode without an explicit model", () => {
		expect(
			createChatCompletionsJsonSchema.parse({
				model_router_mode: "pro",
				messages,
			}),
		).toMatchObject({
			model_router_mode: "pro",
		});
	});

	it("rejects automatic router mode with an explicit model", () => {
		const result = createChatCompletionsJsonSchema.safeParse({
			model: "gpt-5",
			model_router_mode: "pro",
			messages,
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						path: ["model_router_mode"],
						message: "model_router_mode is only valid when no explicit model is provided",
					}),
				]),
			);
		}
	});

	it("rejects automatic router mode with explicit multi-model selection", () => {
		const result = createChatCompletionsJsonSchema.safeParse({
			model_router_mode: "pro",
			models: ["gpt-5", "claude-opus"],
			messages,
			use_multi_model: true,
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						path: ["model_router_mode"],
						message: "model_router_mode is only valid when no explicit model is provided",
					}),
				]),
			);
		}
	});

	it("accepts artifact selection message content parts", () => {
		expect(
			createChatCompletionsJsonSchema.parse({
				model: "gpt-5",
				messages: [
					{
						role: "user",
						content: [
							{ type: "text", text: "Make this firmer" },
							{
								type: "artifact_selection",
								artifact_selection: {
									artifact: {
										identifier: "launch-plan",
										type: "text/markdown",
										title: "Launch plan",
									},
									selectedText: "This paragraph needs work.",
									selectionStart: 12,
									selectionEnd: 38,
								},
							},
						],
					},
				],
			}),
		).toMatchObject({
			messages: [
				{
					content: [
						{ type: "text" },
						{
							type: "artifact_selection",
							artifact_selection: {
								selectedText: "This paragraph needs work.",
							},
						},
					],
				},
			],
		});
	});

	it("accepts custom conversation mode and platform strings", () => {
		expect(
			createChatCompletionsJsonSchema.parse({
				model: "gpt-5",
				mode: "recipe",
				platform: "desktop",
				messages,
			}),
		).toMatchObject({
			mode: "recipe",
			platform: "desktop",
		});
	});

	it("accepts compaction post-processing metadata with a durable compaction message", () => {
		expect(
			createChatCompletionsResponseSchema.parse({
				id: "completion-1",
				log_id: "log-1",
				object: "chat.completion",
				created: 1234,
				choices: [
					{
						index: 0,
						message: {
							role: "assistant",
							content: "Done",
						},
						finish_reason: "stop",
					},
				],
				usage: {
					prompt_tokens: 1,
					completion_tokens: 1,
					total_tokens: 2,
				},
				post_processing: {
					compaction: {
						message: {
							id: "snapshot-1-compaction",
							role: "compaction",
							content: "Context automatically compacted",
							parts: [
								{
									type: "compaction",
									status: "completed",
									label: "Context automatically compacted",
								},
							],
						},
					},
					steps: [{ step: 1 }],
				},
			}),
		).toMatchObject({
			post_processing: {
				compaction: {
					message: {
						id: "snapshot-1-compaction",
						role: "compaction",
					},
				},
			},
		});
	});

	it("preserves tool result choice metadata in non-streaming responses", () => {
		const parsed = createChatCompletionsResponseSchema.parse({
			id: "completion-1",
			log_id: "log-1",
			object: "chat.completion",
			created: 1234,
			choices: [
				{
					index: 0,
					message: {
						role: "assistant",
						content: "Using tool",
					},
					finish_reason: "stop",
				},
				{
					index: 1,
					message: {
						id: "tool_123",
						log_id: "log-1",
						role: "tool",
						name: "test_tool",
						content: "Tool result",
						parts: [
							{
								type: "tool_result",
								name: "test_tool",
								content: "Tool result",
								status: "success",
							},
						],
						citations: null,
						data: null,
						status: "success",
						timestamp: "2023-01-01T00:00:00Z",
						tool_call_id: "call-test-tool",
						tool_call_arguments: '{"input":"value"}',
					},
					finish_reason: "tool_result",
				},
			],
			usage: {
				prompt_tokens: 1,
				completion_tokens: 1,
				total_tokens: 2,
			},
		});

		expect(parsed.choices[1]?.message).toMatchObject({
			id: "tool_123",
			log_id: "log-1",
			role: "tool",
			name: "test_tool",
			tool_call_id: "call-test-tool",
			tool_call_arguments: '{"input":"value"}',
			timestamp: "2023-01-01T00:00:00Z",
		});
	});

	it("rejects malformed compaction post-processing metadata", () => {
		const result = createChatCompletionsResponseSchema.safeParse({
			id: "completion-1",
			log_id: "log-1",
			object: "chat.completion",
			created: 1234,
			choices: [
				{
					index: 0,
					message: {
						role: "assistant",
						content: "Done",
					},
					finish_reason: "stop",
				},
			],
			usage: {
				prompt_tokens: 1,
				completion_tokens: 1,
				total_tokens: 2,
			},
			post_processing: {
				compaction: {
					message: {
						id: "assistant-1",
						role: "assistant",
						content: "Ordinary assistant message",
					},
				},
			},
		});

		expect(result.success).toBe(false);
	});
});
