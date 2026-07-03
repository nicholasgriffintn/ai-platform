import { describe, expect, it } from "vitest";

import {
	isProviderChatMessage,
	normaliseProviderChatMessage,
	toProviderChatMessages,
} from "./provider-messages";

describe("isProviderChatMessage", () => {
	it("accepts ordinary provider-facing chat messages", () => {
		expect(isProviderChatMessage({ id: "user-1", role: "user", content: "Hello" })).toBe(true);
		expect(
			isProviderChatMessage({
				role: "assistant",
				content: [{ type: "text", text: "Hi" }],
				tool_calls: [],
			}),
		).toBe(true);
	});

	it("accepts assistant tool-call messages without content", () => {
		const message = {
			role: "assistant",
			tool_calls: [
				{
					id: "call-weather",
					type: "function",
					function: {
						name: "get_weather",
						arguments: "{}",
					},
				},
			],
		};

		expect(isProviderChatMessage(message)).toBe(true);
		expect(toProviderChatMessages([message])).toEqual([{ ...message, content: "" }]);
	});

	it("rejects compaction status rows and messages carrying compaction parts", () => {
		expect(
			isProviderChatMessage({
				id: "compaction-1",
				role: "compaction",
				content: "Context compacted",
				parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
			}),
		).toBe(false);
		expect(
			isProviderChatMessage({
				id: "assistant-compaction",
				role: "assistant",
				content: "Context compacted",
				parts: [{ type: "compaction", status: "unknown", label: "Context compacted" }],
			}),
		).toBe(false);
	});

	it("rejects malformed chat messages", () => {
		expect(isProviderChatMessage(null)).toBe(false);
		expect(isProviderChatMessage({ role: "assistant", content: ["not-a-content-part"] })).toBe(
			false,
		);
		expect(isProviderChatMessage({ id: 123, role: "user", content: "Hello" })).toBe(false);
		expect(isProviderChatMessage({ role: "compaction", content: "Context compacted" })).toBe(false);
	});
});

describe("toProviderChatMessages", () => {
	it("projects nullable message lists into provider-eligible messages", () => {
		expect(
			toProviderChatMessages([
				{ id: "user-1", role: "user", content: "Hello" },
				{
					id: "compaction-1",
					role: "compaction",
					content: "Context compacted",
					parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
				},
				{ id: "assistant-1", role: "assistant", content: "Hi" },
			]),
		).toEqual([
			{ id: "user-1", role: "user", content: "Hello" },
			{ id: "assistant-1", role: "assistant", content: "Hi" },
		]);
		expect(toProviderChatMessages(undefined)).toEqual([]);
		expect(toProviderChatMessages(null)).toEqual([]);
	});
});

describe("normaliseProviderChatMessage", () => {
	it("normalises provider metadata and drops invalid optional fields", () => {
		expect(
			normaliseProviderChatMessage({
				id: "assistant-1",
				role: "assistant",
				content: [{ type: "text", text: "Hi" }],
				model: "test-model",
				created: 1234,
				timestamp: Number.NaN,
				citations: ["https://example.com", 42],
				parts: [
					{ type: "text", text: "Visible text" },
					{ type: "unknown", text: "Drop me" },
				],
				usage: { total_tokens: 12 },
			}),
		).toEqual({
			id: "assistant-1",
			role: "assistant",
			content: [{ type: "text", text: "Hi" }],
			model: "test-model",
			created: 1234,
			parts: [{ type: "text", text: "Visible text" }],
			usage: { total_tokens: 12 },
		});
	});

	it("preserves string timestamps used by persisted tool responses", () => {
		expect(
			normaliseProviderChatMessage({
				id: "tool-1",
				role: "tool",
				content: "Tool result",
				timestamp: "2023-01-01T00:00:00Z",
			}),
		).toEqual({
			id: "tool-1",
			role: "tool",
			content: "Tool result",
			timestamp: "2023-01-01T00:00:00Z",
		});
	});
});
