import { describe, expect, it } from "vitest";

import { toProviderMessages } from "./provider-messages";

describe("toProviderMessages", () => {
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
