import { createChatCompletionsJsonSchema, messageSchema } from "@assistant/schemas";
import { describe, expect, it } from "vitest";

import type { Message } from "~/types";
import {
	serialiseMessagesForChatRequest,
	serialiseMessagesForConversationUpdate,
} from "../messages";

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

	it("omits null tool calls from chat request messages", () => {
		const messages = JSON.parse(`[
			{
				"id": "user-1",
				"role": "user",
				"content": "How would you design a chair for someone who prefers to work standing up?",
				"tool_calls": null
			}
		]`);

		const requestMessages = serialiseMessagesForChatRequest(messages);

		expect(requestMessages[0]).not.toHaveProperty("tool_calls");
		expect(
			createChatCompletionsJsonSchema.safeParse({
				completion_id: "conversation-1",
				mode: "remote",
				model: "deepseek-v4-flash",
				provider: "deepseek",
				messages: requestMessages,
			}).success,
		).toBe(true);
	});

	it("preserves tool call responses so replayed provider requests stay valid", () => {
		const messages: Message[] = [
			{
				id: "assistant-tool-call",
				role: "assistant",
				content: "",
				tool_calls: [
					{
						id: "call_recipe",
						type: "function",
						function: {
							name: "get_recipe",
							arguments: "{}",
						},
					},
				],
			},
			{
				id: "tool-result",
				role: "tool",
				name: "get_recipe",
				content: "Recipe contract",
				tool_call_id: "call_recipe",
				tool_call_arguments: "{}",
			},
		];

		const requestMessages = serialiseMessagesForChatRequest(messages);

		expect(requestMessages[0]?.tool_calls?.[0]?.id).toBe("call_recipe");
		expect(requestMessages[1]).toMatchObject({
			role: "tool",
			name: "get_recipe",
			tool_call_id: "call_recipe",
			tool_call_arguments: "{}",
		});
		expect(
			createChatCompletionsJsonSchema.safeParse({
				completion_id: "conversation-1",
				mode: "remote",
				model: "deepseek-chat",
				provider: "deepseek",
				messages: requestMessages,
			}).success,
		).toBe(true);
	});
});

describe("serialiseMessagesForConversationUpdate", () => {
	it("encodes citation objects as URL strings for persisted branch updates", () => {
		const messages = JSON.parse(`[
			{
				"id": "assistant-1",
				"role": "assistant",
				"content": "Answer with citations",
				"citations": [
					{
						"url": "https://example.com/source",
						"title": "Example source"
					},
					"https://example.com/already-string",
					{
						"title": "Missing URL"
					}
				]
			}
		]`);

		const requestMessages = serialiseMessagesForConversationUpdate(messages);

		expect(requestMessages[0]?.citations).toEqual([
			"https://example.com/source",
			"https://example.com/already-string",
		]);
		expect(messageSchema.safeParse(requestMessages[0]).success).toBe(true);
	});

	it("keeps tool call ids when persisting tool responses", () => {
		const messages: Message[] = [
			{
				id: "tool-result",
				role: "tool",
				name: "get_recipe",
				content: "Recipe contract",
				tool_call_id: "call_recipe",
				tool_call_arguments: "{}",
			},
		];

		const requestMessages = serialiseMessagesForConversationUpdate(messages);

		expect(requestMessages[0]).toMatchObject({
			role: "tool",
			name: "get_recipe",
			tool_call_id: "call_recipe",
			tool_call_arguments: "{}",
		});
		expect(messageSchema.safeParse(requestMessages[0]).success).toBe(true);
	});
});
