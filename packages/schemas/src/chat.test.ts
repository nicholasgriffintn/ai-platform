import { describe, expect, it } from "vitest";

import {
	compactChatCompletionResponseSchema,
	generateChatCompletionTitleJsonSchema,
	getChatCompletionMessagesResponseSchema,
	getMessageResponseSchema,
} from "./chat";

describe("chat schemas", () => {
	it("accepts stored assistant messages represented by parts and tool calls", () => {
		const result = getChatCompletionMessagesResponseSchema.safeParse({
			conversation_id: "1d465ce1-a3ee-4818-97ad-30f633330c2c",
			messages: [
				{
					id: "be7d21b2-af66-4c7c-b45a-48c80f9344ab",
					role: "user",
					content: "GTA 6 is coming out, write me a letter",
				},
				{
					id: "70ae18ed-ecf0-4de1-8ab5-0fa8429ef440",
					role: "assistant",
					parts: [
						{
							timestamp: 1782854043514,
							type: "reasoning",
							text: "Let me search for the latest GTA 6 release information.",
							collapsed: true,
						},
						{
							timestamp: 1782854043572,
							type: "tool_use",
							name: "web_search",
							toolCallId: "call_00_EPBIreC96A2WzsLns7Ov9665",
							input: {
								query: "GTA 6 release date 2026 latest news",
								search_depth: "advanced",
							},
						},
					],
					tool_calls: [
						{
							id: "call_00_EPBIreC96A2WzsLns7Ov9665",
							type: "function",
							function: {
								name: "web_search",
								arguments:
									'{"query": "GTA 6 release date 2026 latest news", "search_depth": "advanced"}',
							},
						},
					],
				},
			],
		});

		expect(result.success).toBe(true);
	});

	it("accepts stored message rows with nullable database metadata", () => {
		const message = {
			id: "snapshot-1-compaction",
			conversation_id: "conversation-1",
			parent_message_id: null,
			role: "compaction",
			content: "Context compacted",
			name: null,
			tool_calls: null,
			citations: null,
			model: null,
			status: null,
			timestamp: 1783110534616,
			platform: "api",
			mode: "remote",
			log_id: null,
			data: null,
			created_at: "2026-07-03 20:28:55",
			updated_at: "2026-07-03 20:28:55",
			parts: [
				{
					timestamp: 1783110534616,
					type: "compaction",
					status: "completed",
					label: "Context compacted",
				},
			],
			tool_call_id: null,
			app: null,
			tool_call_arguments: null,
			is_archived: 1,
		};

		expect(
			getChatCompletionMessagesResponseSchema.safeParse({
				conversation_id: "conversation-1",
				messages: [message],
			}).success,
		).toBe(true);
		expect(
			getMessageResponseSchema.safeParse({
				...message,
				conversation_id: "conversation-1",
			}).success,
		).toBe(true);
	});

	it("accepts compact responses with visible compaction status messages", () => {
		const result = compactChatCompletionResponseSchema.safeParse({
			compacted: true,
			conversation: {
				id: "conversation-1",
				title: "Bottle ideas",
				messages: [
					{
						id: "snapshot-1-compaction",
						role: "compaction",
						content: "Context compacted",
						parts: [
							{
								type: "compaction",
								status: "completed",
								label: "Context compacted",
							},
						],
					},
				],
			},
		});

		expect(result.success).toBe(true);
	});

	it("rejects compact responses without valid visible messages", () => {
		const result = compactChatCompletionResponseSchema.safeParse({
			compacted: true,
			conversation: {
				id: "conversation-1",
				messages: [
					{
						id: "snapshot-1-compaction",
						role: "status",
						content: "Context compacted",
					},
				],
			},
		});

		expect(result.success).toBe(false);
	});

	it("rejects compact responses with role-only compaction markers", () => {
		const result = compactChatCompletionResponseSchema.safeParse({
			compacted: true,
			conversation: {
				id: "conversation-1",
				messages: [
					{
						id: "snapshot-1-compaction",
						role: "compaction",
						content: "Context compacted",
					},
				],
			},
		});

		expect(result.success).toBe(false);
	});

	it("rejects compacted responses that do not include a visible compaction message", () => {
		const result = compactChatCompletionResponseSchema.safeParse({
			compacted: true,
			conversation: {
				id: "conversation-1",
				messages: [
					{
						id: "assistant-1",
						role: "assistant",
						content: "Previous answer",
					},
				],
			},
		});

		expect(result.success).toBe(false);
	});

	it("accepts no-op compact responses without compaction markers", () => {
		const result = compactChatCompletionResponseSchema.safeParse({
			compacted: false,
			conversation: {
				id: "conversation-1",
				messages: [
					{
						id: "assistant-1",
						role: "assistant",
						content: "Previous answer",
					},
				],
			},
		});

		expect(result.success).toBe(true);
	});

	it("accepts visible compaction messages in title generation requests", () => {
		const result = generateChatCompletionTitleJsonSchema.safeParse({
			messages: [
				{
					role: "user",
					content: "What was this conversation about?",
				},
				{
					role: "compaction",
					content: "Context compacted",
					parts: [
						{
							type: "compaction",
							status: "completed",
							label: "Context compacted",
						},
					],
				},
			],
			store: true,
		});

		expect(result.success).toBe(true);
	});

	it("accepts visible compaction messages in single message responses", () => {
		const result = getMessageResponseSchema.safeParse({
			id: "snapshot-1-compaction",
			conversation_id: "conversation-1",
			role: "compaction",
			content: "Context compacted",
			parts: [
				{
					type: "compaction",
					status: "completed",
					label: "Context compacted",
				},
			],
		});

		expect(result.success).toBe(true);
	});
});
