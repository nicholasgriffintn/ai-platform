import { describe, expect, it } from "vitest";

import { createChatCompletionsJsonSchema } from "./chat-completions";
import { messageSchema } from "./shared";

describe("messageSchema", () => {
	it("accepts persisted assistant metadata for durable conversation display", () => {
		const parsed = messageSchema.safeParse({
			id: "assistant-1",
			completion_id: "conversation-1",
			role: "assistant",
			content: "Done",
			created: 1234,
			provider: "deepseek",
			reasoning: {
				collapsed: true,
				content: "Internal summary",
			},
			usage: {
				total_tokens: 42,
			},
		});

		expect(parsed.success).toBe(true);
		expect(parsed.data).toEqual(
			expect.objectContaining({
				completion_id: "conversation-1",
				created: 1234,
				provider: "deepseek",
				reasoning: {
					collapsed: true,
					content: "Internal summary",
				},
				usage: {
					total_tokens: 42,
				},
			}),
		);
	});

	it("preserves structured tool calls for durable conversation display", () => {
		const parsed = messageSchema.safeParse({
			id: "assistant-tool-call",
			role: "assistant",
			content: "Using tool",
			tool_calls: [
				{
					id: "call-1",
					type: "function",
					index: 0,
					function: {
						name: "search",
						arguments: {
							query: "context compaction",
						},
					},
				},
			],
		});

		expect(parsed.success).toBe(true);
		expect(parsed.data).toEqual(
			expect.objectContaining({
				tool_calls: [
					{
						id: "call-1",
						type: "function",
						index: 0,
						function: {
							name: "search",
							arguments: {
								query: "context compaction",
							},
						},
					},
				],
			}),
		);
	});

	it("accepts compaction status messages for durable conversation display", () => {
		expect(
			messageSchema.safeParse({
				id: "snapshot-1-compaction",
				role: "compaction",
				content: "Context automatically compacted",
				mode: "build",
				platform: "dynamic-apps",
				parts: [
					{
						type: "compaction",
						status: "completed",
						label: "Context automatically compacted",
					},
				],
			}).success,
		).toBe(true);
	});

	it("accepts persisted instruction roles for durable conversation display", () => {
		for (const role of ["system", "developer"] as const) {
			expect(
				messageSchema.safeParse({
					id: `message-${role}`,
					role,
					content: `Content for ${role}`,
				}).success,
			).toBe(true);
		}
	});

	it("rejects unknown compaction progress statuses when parsing durable messages", () => {
		const parsed = messageSchema.safeParse({
			id: "snapshot-1-compaction",
			role: "compaction",
			content: "Automatically compacting context",
			parts: [
				{
					type: "compaction",
					status: "unknown",
					label: "Automatically compacting context",
				},
			],
		});

		expect(parsed.success).toBe(false);
	});

	it("rejects pending compaction status rows when parsing durable messages", () => {
		const parsed = messageSchema.safeParse({
			id: "snapshot-1-compaction",
			role: "compaction",
			content: "Automatically compacting context",
			parts: [
				{
					type: "compaction",
					status: "pending",
					label: "Automatically compacting context",
				},
			],
		});

		expect(parsed.success).toBe(false);
	});

	it("rejects role-only compaction messages when parsing durable messages", () => {
		const parsed = messageSchema.safeParse({
			id: "snapshot-1-compaction",
			role: "compaction",
			content: "Context automatically compacted",
		});

		expect(parsed.success).toBe(false);
	});

	it("does not allow compaction status messages in provider chat completion requests", () => {
		expect(
			createChatCompletionsJsonSchema.safeParse({
				model: "test-model",
				messages: [
					{
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
				],
			}).success,
		).toBe(false);
	});

	it("does not allow role-only compaction messages in provider chat completion requests", () => {
		expect(
			createChatCompletionsJsonSchema.safeParse({
				model: "test-model",
				messages: [
					{
						id: "snapshot-1-compaction",
						role: "compaction",
						content: "Context automatically compacted",
					},
				],
			}).success,
		).toBe(false);
	});

	it("does not allow assistant-shaped compaction status messages in provider chat completion requests", () => {
		expect(
			createChatCompletionsJsonSchema.safeParse({
				model: "test-model",
				messages: [
					{
						id: "snapshot-1-compaction",
						role: "assistant",
						parts: [
							{
								type: "compaction",
								status: "completed",
								label: "Context automatically compacted",
							},
						],
					},
				],
			}).success,
		).toBe(false);
	});
});
