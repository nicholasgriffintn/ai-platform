import { createChatCompletionsJsonSchema } from "@assistant/schemas";
import { describe, expect, it } from "vitest";

import type { Message } from "~/types";
import { serialiseMessagesForChatRequest } from "../messages";

describe("serialiseMessagesForChatRequest", () => {
	it("removes reasoning-only content blocks from replayed assistant messages", () => {
		const messages: Message[] = [
			{
				id: "user-1",
				role: "user",
				content: "hi",
			},
			{
				id: "assistant-1",
				role: "assistant",
				content: [
					{
						type: "thinking",
						thinking: "private reasoning",
						signature: "",
					},
					{
						type: "text",
						text: "Visible response",
					},
				],
				parts: [
					{
						type: "reasoning",
						text: "private reasoning",
						collapsed: true,
					},
					{
						type: "text",
						text: "Visible response",
					},
				],
			},
			{
				id: "user-2",
				role: "user",
				content: "What can you do?",
			},
		];

		const requestMessages = serialiseMessagesForChatRequest(messages);

		expect(requestMessages[1]?.content).toBe("Visible response");
		expect(requestMessages[1]?.parts).toEqual(messages[1]?.parts);
		expect(
			createChatCompletionsJsonSchema.safeParse({
				completion_id: "conversation-1",
				mode: "remote",
				model: "@cf/zai-org/glm-4.7-flash",
				messages: requestMessages,
			}).success,
		).toBe(true);
	});
});
