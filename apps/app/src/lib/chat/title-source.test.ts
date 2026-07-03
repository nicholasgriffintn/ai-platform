import { describe, expect, it } from "vitest";

import type { Message } from "~/types";
import {
	createTemporaryConversationTitle,
	getConversationTitleSourceMessage,
} from "./title-source";

describe("conversation title source", () => {
	it("uses the first non-compaction message with text", () => {
		const messages: Message[] = [
			{
				id: "compaction-1",
				role: "compaction",
				content: "Context compacted",
				parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
			},
			{
				id: "user-1",
				role: "user",
				content: "Brainstorm bottle ideas",
			},
		];

		expect(getConversationTitleSourceMessage(messages)?.id).toBe("user-1");
		expect(createTemporaryConversationTitle(messages)).toBe("Brainstorm bottle ideas");
	});

	it("falls back when every message is display-only", () => {
		const messages: Message[] = [
			{
				id: "compaction-1",
				role: "compaction",
				content: "Context compacted",
				parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
			},
		];

		expect(getConversationTitleSourceMessage(messages)).toBeUndefined();
		expect(createTemporaryConversationTitle(messages)).toBe("New Conversation");
	});
});
