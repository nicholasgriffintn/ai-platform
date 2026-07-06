import { describe, expect, it } from "vitest";

import { isProviderChatMessage, toProviderChatMessages } from "./provider-messages";

describe("toProviderChatMessages", () => {
	it("excludes compaction rows and malformed compaction metadata from provider context", () => {
		expect(
			toProviderChatMessages([
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
					parts: [{ type: "compaction", status: "unknown", label: "Context compacted" }],
				},
				{ id: "assistant-1", role: "assistant", content: "Hi" },
			]),
		).toEqual([
			{ id: "user-1", role: "user", content: "Hello" },
			{ id: "assistant-1", role: "assistant", content: "Hi" },
		]);
	});

	it("keeps assistant tool-call messages without content provider-eligible", () => {
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
});
