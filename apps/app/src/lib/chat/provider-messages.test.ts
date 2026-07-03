import { describe, expect, it } from "vitest";

import { toProviderMessages } from "./provider-messages";

describe("toProviderMessages", () => {
	it("projects nullable message lists into provider-eligible messages", () => {
		expect(
			toProviderMessages([
				{ id: "user-1", role: "user", content: "Hello" },
				{
					id: "compaction-1",
					role: "compaction",
					content: "Context compacted",
					parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
				},
				{
					id: "assistant-compaction",
					role: "assistant",
					content: "Context compacted",
					parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
				},
				{ id: "assistant-1", role: "assistant", content: "Hi" },
			]),
		).toEqual([
			{ id: "user-1", role: "user", content: "Hello" },
			{ id: "assistant-1", role: "assistant", content: "Hi" },
		]);
		expect(toProviderMessages(undefined)).toEqual([]);
		expect(toProviderMessages(null)).toEqual([]);
	});

	it("excludes malformed assistant-shaped compaction metadata from provider messages", () => {
		expect(
			toProviderMessages([
				{ id: "user-1", role: "user", content: "Hello" },
				{
					id: "assistant-compaction",
					role: "assistant",
					content: "Context compacted",
					parts: [{ type: "compaction", status: "unknown", label: "Context compacted" }],
				},
				{ id: "assistant-1", role: "assistant", content: "Hi" },
			]),
		).toEqual([
			{ id: "user-1", role: "user", content: "Hello" },
			{ id: "assistant-1", role: "assistant", content: "Hi" },
		]);
	});

	it("keeps assistant tool-call turns without content eligible for provider messages", () => {
		const toolCallMessage = {
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

		expect(toProviderMessages([toolCallMessage])).toEqual([{ ...toolCallMessage, content: "" }]);
	});

	it("drops string timestamps from provider-context messages", () => {
		expect(
			toProviderMessages([
				{
					id: "tool-1",
					role: "tool",
					content: "Tool result",
					timestamp: "2023-01-01T00:00:00Z",
				},
			]),
		).toEqual([
			{
				id: "tool-1",
				role: "tool",
				content: "Tool result",
			},
		]);
	});
});
