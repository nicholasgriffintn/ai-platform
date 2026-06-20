import { describe, expect, it } from "vitest";

import type { Message } from "~/types";
import { getRecipeConversationContext } from "../conversationContext";

describe("recipe conversation context", () => {
	it("loads bounded user and assistant context without tool-call messages", async () => {
		const messages: Message[] = [
			{ role: "user", content: "older context" },
			{ role: "tool", name: "web_search", content: "tool result" },
			{
				role: "assistant",
				content: "",
				tool_calls: [{ id: "tool-call-1", function: { name: "trigger_recipe" } }],
			},
			{ role: "assistant", content: "I can run that recipe." },
			{ role: "user", content: "Use the London office." },
		];
		const conversationManager = {
			get: async () => messages,
		};

		const result = await getRecipeConversationContext({
			conversationManager,
			conversationId: "completion-id",
			limit: 2,
		});

		expect(result).toEqual([
			{ role: "assistant", content: "I can run that recipe." },
			{ role: "user", content: "Use the London office." },
		]);
	});

	it("returns no context when a conversation reader is unavailable", async () => {
		await expect(
			getRecipeConversationContext({ conversationId: "completion-id" }),
		).resolves.toEqual([]);
	});
});
