import { createChatCompletionsJsonSchema, messageSchema } from "@assistant/schemas";
import { describe, expect, it } from "vitest";

import type { Message } from "~/types";
import { prepareUserMessage } from "../chat/prepare-user-message";
import {
	formattedMessageContent,
	normalizeMessage,
	serialiseMessagesForChatRequest,
	serialiseMessagesForConversationUpdate,
} from "../messages";

describe("serialiseMessagesForChatRequest", () => {
	it("does not send compaction status messages to chat completions", () => {
		const messages: Message[] = [
			{
				id: "user-1",
				role: "user",
				content: "Help me brainstorm creative uses for old wine bottles.",
			},
			{
				id: "assistant-1",
				role: "assistant",
				content: "Use bottles as candle holders.",
			},
			{
				id: "compaction-1",
				role: "compaction",
				content: "Context compacted",
				parts: [
					{
						type: "compaction",
						status: "completed",
						label: "Context compacted",
					},
				],
			},
			{
				id: "user-2",
				role: "user",
				content: "Repeat this conversation",
			},
			{
				id: "compaction-2",
				role: "assistant",
				content: "Context compacted",
				parts: [
					{
						type: "compaction",
						status: "completed",
						label: "Context compacted",
					},
				],
			},
		];

		const requestMessages = serialiseMessagesForChatRequest(messages);

		expect(requestMessages.map((message) => message.role)).toEqual(["user", "assistant", "user"]);
		expect(
			createChatCompletionsJsonSchema.safeParse({
				messages: requestMessages,
				model: "gpt-5",
			}).success,
		).toBe(true);
	});

	it("sends snapshot messages as text without internal parts", () => {
		const messages: Message[] = [
			{
				id: "snapshot-1",
				role: "assistant",
				content: "Conversation snapshot\n\nEarlier context summary.",
				parts: [
					{
						type: "snapshot",
						title: "Conversation snapshot",
						summary: "Earlier context summary.",
					},
					{
						type: "text",
						text: "Conversation snapshot\n\nEarlier context summary.",
					},
				],
			},
		];

		const requestMessages = serialiseMessagesForChatRequest(messages);

		expect(requestMessages).toEqual([
			{
				id: "snapshot-1",
				role: "assistant",
				content: "Conversation snapshot\n\nEarlier context summary.",
			},
		]);
	});

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
		expect(requestMessages[1]).not.toHaveProperty("parts");
		expect(
			createChatCompletionsJsonSchema.safeParse({
				messages: requestMessages,
				model: "gpt-5",
			}).success,
		).toBe(true);
	});

	it("does not send duplicate content and parts for replayed assistant messages", () => {
		const messages: Message[] = [
			{
				id: "user-1",
				role: "user",
				content: "hi",
			},
			{
				id: "assistant-1",
				role: "assistant",
				content: "Hi! How can I help?",
				parts: [
					{
						type: "text",
						text: "Hi! How can I help?",
					},
				],
			},
			{
				id: "user-2",
				role: "user",
				content: "why",
			},
		];

		const requestMessages = serialiseMessagesForChatRequest(messages);

		expect(requestMessages[1]).toEqual({
			id: "assistant-1",
			role: "assistant",
			content: "Hi! How can I help?",
		});
		expect(
			createChatCompletionsJsonSchema.safeParse({
				messages: requestMessages,
				model_router_mode: "lite",
			}).success,
		).toBe(true);
	});

	it("keeps upload attachments in content parts for chat requests", () => {
		const message = prepareUserMessage(
			"review this",
			[
				{
					type: "document",
					data: "https://files.test/spec.pdf",
					name: "spec.pdf",
				},
				{
					type: "markdown_document",
					data: "https://files.test/readme.md",
					name: "readme.md",
					markdown: "# Readme",
				},
			],
			"model-1",
		);

		const requestMessages = serialiseMessagesForChatRequest([message]);

		expect(requestMessages[0]).toMatchObject({
			role: "user",
			content: [
				{ type: "text", text: "review this" },
				{
					type: "document_url",
					document_url: {
						url: "https://files.test/spec.pdf",
						name: "spec.pdf",
					},
				},
				{
					type: "markdown_document",
					markdown_document: {
						markdown: "# Readme",
						name: "readme.md",
					},
				},
			],
		});
		expect(requestMessages[0]).not.toHaveProperty("parts");
		expect(
			createChatCompletionsJsonSchema.safeParse({
				messages: requestMessages,
				model: "gpt-5",
			}).success,
		).toBe(true);
	});

	it("uses parts when replayed content is blank", () => {
		const messages: Message[] = [
			{
				id: "assistant-1",
				role: "assistant",
				content: "",
				parts: [
					{
						type: "text",
						text: "Recovered from parts",
					},
				],
			},
		];

		const requestMessages = serialiseMessagesForChatRequest(messages);

		expect(requestMessages[0]).toEqual({
			id: "assistant-1",
			role: "assistant",
			parts: [
				{
					type: "text",
					text: "Recovered from parts",
				},
			],
		});
		expect(
			createChatCompletionsJsonSchema.safeParse({
				messages: requestMessages,
				model: "gpt-5",
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
	});

	it("deduplicates repeated assistant tool calls before replaying provider requests", () => {
		const messages: Message[] = [
			{
				id: "assistant-tool-call",
				role: "assistant",
				content: "Searching...",
				tool_calls: [
					{
						id: "call_00_search",
						type: "function",
						function: {
							name: "web_search",
							arguments: '{"query":"Polychat"}',
						},
					},
					{
						id: "call_00_search",
						type: "function",
						function: {
							name: "web_search",
							arguments: {
								query: "Polychat",
							},
						},
					},
				],
			},
		];

		const requestMessages = serialiseMessagesForChatRequest(messages);
		const updateMessages = serialiseMessagesForConversationUpdate(messages);

		expect(requestMessages[0]?.tool_calls).toHaveLength(1);
		expect(requestMessages[0]?.tool_calls?.[0]?.id).toBe("call_00_search");
		expect(updateMessages[0]?.tool_calls).toHaveLength(1);
		expect(updateMessages[0]?.tool_calls?.[0]?.id).toBe("call_00_search");
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

	it("preserves durable compaction marker metadata for persisted conversation updates", () => {
		const messages: Message[] = [
			{
				id: "snapshot-1-compaction",
				completion_id: "conversation-1",
				role: "compaction",
				content: "Context automatically compacted",
				created: 1234,
				provider: "deepseek",
				mode: "remote",
				platform: "web",
				usage: {
					total_tokens: 42,
				},
				parts: [
					{
						id: "compaction-part-1",
						type: "compaction",
						status: "completed",
						label: "Context automatically compacted",
						metadata: {
							source: "automatic-compaction",
						},
					},
				],
			},
		];

		const requestMessages = serialiseMessagesForConversationUpdate(messages);

		expect(requestMessages[0]).toEqual(
			expect.objectContaining({
				id: "snapshot-1-compaction",
				completion_id: "conversation-1",
				role: "compaction",
				content: "Context automatically compacted",
				created: 1234,
				provider: "deepseek",
				mode: "remote",
				platform: "web",
				usage: {
					total_tokens: 42,
				},
				parts: [
					expect.objectContaining({
						id: "compaction-part-1",
						type: "compaction",
						metadata: {
							source: "automatic-compaction",
						},
					}),
				],
			}),
		);
		expect(messageSchema.safeParse(requestMessages[0]).success).toBe(true);
	});
});

describe("normalizeMessage", () => {
	it("normalises record content from durable messages into renderable text", () => {
		const result = normalizeMessage({
			id: "tool-json",
			role: "tool",
			content: {
				status: "ok",
				items: ["alpha"],
			},
		});

		expect(result.content).toBe(JSON.stringify({ status: "ok", items: ["alpha"] }));
		expect(messageSchema.safeParse(result).success).toBe(true);
	});

	it("normalises persisted snake-case tool part identifiers", () => {
		const result = normalizeMessage({
			id: "assistant-tools",
			role: "assistant",
			content: "",
			parts: [
				{
					type: "tool_use",
					name: "web_search",
					tool_call_id: "call-search",
					input: { query: "context compaction" },
				},
				{
					type: "tool_result",
					tool_call_id: "call-search",
					content: "Search result",
				},
			],
		});

		expect(result.parts).toEqual([
			expect.objectContaining({
				type: "tool_use",
				toolCallId: "call-search",
			}),
			expect.objectContaining({
				type: "tool_result",
				toolCallId: "call-search",
			}),
		]);
		expect(messageSchema.safeParse(result).success).toBe(true);
	});

	it("keeps malformed role-level compaction metadata display-only during normalisation", () => {
		const result = normalizeMessage({
			id: "compaction-invalid",
			role: "compaction",
			content: "Context compacted",
			parts: [{ type: "compaction", status: "unknown", label: "Context compacted" }],
		});

		expect(result.role).toBe("compaction");
		expect(result.parts).toBeUndefined();
		expect(serialiseMessagesForChatRequest([result])).toEqual([]);
	});
});

describe("formattedMessageContent", () => {
	it("preserves inline artifact display metadata", () => {
		const result = formattedMessageContent(
			"assistant",
			'Here is the interface:<artifact identifier="orbit-demo" type="text/html" title="Orbit demo" display="inline"><div>Orbit</div></artifact>',
		);

		expect(result.content).toBe("Here is the interface:[[ARTIFACT:orbit-demo]]");
		expect(result.artifacts[0]).toMatchObject({
			identifier: "orbit-demo",
			type: "text/html",
			title: "Orbit demo",
			display: "inline",
			content: "<div>Orbit</div>",
		});
	});

	it("replaces artifact placeholders when identifiers contain regex characters", () => {
		const result = formattedMessageContent(
			"assistant",
			'<artifact identifier="app[1]" type="text/markdown" title="App notes">Literal id</artifact>',
		);

		expect(result.content).toBe("[[ARTIFACT:app[1]]]");
		expect(result.artifacts[0]?.identifier).toBe("app[1]");
	});
});
