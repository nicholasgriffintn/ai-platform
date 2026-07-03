import { describe, expect, it } from "vitest";

import { canReplaceStoredConversationMessages } from "./conversation-replacement";

describe("canReplaceStoredConversationMessages", () => {
	it("blocks replacing stored messages from compacted visible history", () => {
		expect(
			canReplaceStoredConversationMessages([
				{ id: "old-user", role: "user", content: "Old visible turn" },
				{
					id: "snapshot-1-compaction",
					role: "compaction",
					content: "Context compacted",
					parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
				},
				{ id: "latest-user", role: "user", content: "Current question" },
			]),
		).toBe(false);
	});

	it("allows ordinary active message replacement", () => {
		expect(
			canReplaceStoredConversationMessages([
				{ id: "user-1", role: "user", content: "Question" },
				{ id: "assistant-1", role: "assistant", content: "Answer" },
			]),
		).toBe(true);
	});

	it("blocks malformed assistant-shaped compaction metadata", () => {
		expect(
			canReplaceStoredConversationMessages([
				{ id: "user-1", role: "user", content: "Question" },
				{
					id: "assistant-compaction",
					role: "assistant",
					content: "Context compacted",
					parts: [{ type: "compaction", status: "unknown", label: "Context compacted" }],
				},
				{ id: "assistant-1", role: "assistant", content: "Answer" },
			]),
		).toBe(false);
	});
});
