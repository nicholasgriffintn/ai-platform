import { describe, expect, it } from "vitest";

import type { Conversation } from "~/types";
import { preserveOptimisticMessages } from "../conversations";

function conversation(id: string, messages: Conversation["messages"]): Conversation {
	return {
		id,
		title: "Test",
		messages,
	};
}

describe("preserveOptimisticMessages", () => {
	it("keeps cached optimistic messages when fetched conversation is behind", () => {
		const cached = conversation("one", [
			{ id: "user-1", role: "user", content: "Initial", model: "" },
			{ id: "assistant-1", role: "assistant", content: "Streaming", model: "" },
		]);
		const fetched = conversation("one", []);

		expect(preserveOptimisticMessages(fetched, cached)?.messages).toEqual(cached.messages);
	});

	it("uses fetched messages once fetched conversation catches up", () => {
		const cached = conversation("one", [
			{ id: "user-1", role: "user", content: "Initial", model: "" },
		]);
		const fetched = conversation("one", [
			{ id: "user-1", role: "user", content: "Initial", model: "" },
			{ id: "assistant-1", role: "assistant", content: "Done", model: "" },
		]);

		expect(preserveOptimisticMessages(fetched, cached)).toBe(fetched);
	});
});
