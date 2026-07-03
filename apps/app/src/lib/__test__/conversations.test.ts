import { describe, expect, it } from "vitest";

import type { Conversation } from "~/types";
import { createConversationId, preserveOptimisticMessages } from "../conversations";

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

	it("keeps cached assistant content when fetched conversation has a stale placeholder", () => {
		const cached = conversation("one", [
			{ id: "user-1", role: "user", content: "1", model: "" },
			{
				id: "assistant-final",
				role: "assistant",
				content: 'Hello! I see you\'ve entered "1"',
				model: "labs-leanstral-2603",
			},
		]);
		const fetched = conversation("one", [
			{ id: "user-1", role: "user", content: "1", model: "" },
			{
				id: "assistant-placeholder",
				role: "assistant",
				content: "",
				model: "auto",
			},
		]);

		expect(preserveOptimisticMessages(fetched, cached)?.messages).toEqual(cached.messages);
	});

	it("keeps cached assistant parts when fetched conversation has empty assistant content", () => {
		const cached = conversation("one", [
			{ id: "user-1", role: "user", content: "1", model: "" },
			{
				id: "assistant-final",
				role: "assistant",
				content: "",
				model: "labs-leanstral-2603",
				parts: [
					{
						type: "text",
						text: "Hello from parts",
					},
				],
			},
		]);
		const fetched = conversation("one", [
			{ id: "user-1", role: "user", content: "1", model: "" },
			{
				id: "assistant-placeholder",
				role: "assistant",
				content: "",
				model: "auto",
			},
		]);

		expect(preserveOptimisticMessages(fetched, cached)?.messages).toEqual(cached.messages);
	});

	it("keeps cached visible assistant text when fetched conversation only has reasoning", () => {
		const cached = conversation("one", [
			{ id: "user-1", role: "user", content: "Question", model: "" },
			{
				id: "assistant-final",
				role: "assistant",
				content: "Final answer",
				model: "deepseek-v4-pro",
			},
		]);
		const fetched = conversation("one", [
			{ id: "user-1", role: "user", content: "Question", model: "" },
			{
				id: "assistant-stale",
				role: "assistant",
				content: "",
				model: "deepseek-v4-pro",
				parts: [
					{
						type: "reasoning",
						text: "Still thinking",
					},
				],
			},
		]);

		expect(preserveOptimisticMessages(fetched, cached)?.messages).toEqual(cached.messages);
	});

	it("returns null instead of undefined when neither remote nor local chat exists", () => {
		expect(preserveOptimisticMessages(undefined, undefined)).toBeNull();
	});
});

describe("createConversationId", () => {
	it("creates IDs through the shared conversation helper", () => {
		expect(createConversationId()).toEqual(expect.any(String));
		expect(createConversationId().length).toBeGreaterThan(0);
	});
});
