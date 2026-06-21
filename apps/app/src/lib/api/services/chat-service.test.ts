import { afterEach, describe, expect, it, vi } from "vitest";

import type { Message } from "~/types";
import { ChatService } from "./chat-service";

function createSseResponse(events: string[]): Response {
	const encoder = new TextEncoder();
	return new Response(
		new ReadableStream({
			start(controller) {
				for (const event of events) {
					controller.enqueue(encoder.encode(event));
				}
				controller.close();
			},
		}),
		{
			headers: {
				"Content-Type": "text/event-stream",
			},
		},
	);
}

function data(payload: unknown) {
	return `data: ${typeof payload === "string" ? payload : JSON.stringify(payload)}\n\n`;
}

describe("ChatService streaming", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("emits separate assistant messages for recursive streamed turns", async () => {
		const toolCalls = [
			{
				id: "call-web-search",
				type: "function",
				function: {
					name: "web_search",
					arguments: '{"query":"recipe setup"}',
				},
			},
		];
		const duplicateToolResponse = {
			type: "tool_response",
			tool_id: "tool-result-1",
			result: {
				role: "tool",
				id: "tool-result-1",
				name: "web_search",
				content: "Web search completed",
				status: "success",
				tool_call_id: "call-web-search",
				tool_call_arguments: '{"query":"recipe setup"}',
				data: {
					responseType: "text",
				},
			},
		};
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				createSseResponse([
					data({ type: "content_block_delta", content: "First turn" }),
					data({ type: "content_block_stop" }),
					data({
						type: "message_delta",
						message_id: "assistant-1",
						created: 1000,
						model: "test-model",
						tool_calls: toolCalls,
						parts: [
							{ type: "text", text: "First turn", timestamp: 1000 },
							{
								type: "tool_use",
								name: "web_search",
								toolCallId: "call-web-search",
								input: { query: "recipe setup" },
								timestamp: 1000,
							},
						],
					}),
					data({ type: "message_stop" }),
					data(duplicateToolResponse),
					data(duplicateToolResponse),
					data({ type: "tool_response_end" }),
					data({ type: "content_block_delta", content: "Second turn" }),
					data({ type: "content_block_stop" }),
					data({
						type: "message_delta",
						message_id: "assistant-2",
						created: 2000,
						model: "test-model",
						parts: [{ type: "text", text: "Second turn", timestamp: 2000 }],
					}),
					data({ type: "message_stop" }),
					data("[DONE]"),
				]),
			),
		);

		const assistantMessages: Message[] = [];
		const toolMessages: Message[] = [];
		const service = new ChatService(async () => ({}));

		const result = await service.streamChatCompletions({
			chatSettings: {},
			completionId: "conversation-1",
			messages: [{ role: "user", content: "hello" } as Message],
			mode: "remote",
			model: "test-model",
			onProgress: (_text, _reasoning, toolResponses, _done, assistantMessage) => {
				if (assistantMessage) {
					assistantMessages.push(assistantMessage);
				}
				if (toolResponses) {
					toolMessages.push(...toolResponses);
				}
			},
			onStateChange: () => {},
			signal: new AbortController().signal,
		});

		expect(assistantMessages.map((message) => message.id)).toEqual(["assistant-1", "assistant-2"]);
		expect(assistantMessages.map((message) => message.content)).toEqual([
			"First turn",
			"Second turn",
		]);
		expect(assistantMessages[0]?.tool_calls).toEqual(toolCalls);
		expect(toolMessages).toHaveLength(1);
		expect(toolMessages[0]).toMatchObject({
			tool_call_id: "call-web-search",
			tool_call_arguments: '{"query":"recipe setup"}',
		});
		expect(result.id).toBe("assistant-2");
		expect(result.content).toBe("Second turn");
	});

	it("uses final message_delta content when a stream revises the combined assistant message", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				createSseResponse([
					data({ type: "content_block_delta", content: "Primary answer" }),
					data({
						type: "message_delta",
						message_id: "assistant-1",
						created: 1000,
						model: "primary-model",
					}),
					data({ type: "content_block_delta", content: "Secondary answer" }),
					data({
						type: "message_delta",
						message_id: "assistant-1",
						created: 1001,
						model: "primary-model",
						content: "Primary answer\n\nSecondary answer",
					}),
					data("[DONE]"),
				]),
			),
		);

		const assistantMessages: Message[] = [];
		const service = new ChatService(async () => ({}));

		const result = await service.streamChatCompletions({
			chatSettings: {},
			completionId: "conversation-1",
			messages: [{ role: "user", content: "hello" } as Message],
			mode: "remote",
			model: "primary-model",
			onProgress: (_text, _reasoning, _toolResponses, _done, assistantMessage) => {
				if (assistantMessage) {
					assistantMessages.push(assistantMessage);
				}
			},
			onStateChange: () => {},
			signal: new AbortController().signal,
		});

		expect(result.content).toBe("Primary answer\n\nSecondary answer");
		expect(result.parts).toEqual([
			expect.objectContaining({
				type: "text",
				text: "Primary answer\n\nSecondary answer",
			}),
		]);
		expect(assistantMessages.at(-1)?.content).toBe("Primary answer\n\nSecondary answer");
	});

	it("sends provider options inside request options", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			createSseResponse([data("[DONE]")]),
		);
		vi.stubGlobal("fetch", fetchMock);

		const service = new ChatService(async () => ({}));

		await service.streamChatCompletions({
			chatSettings: {
				tool_options: {
					image_generation: {
						size: "1024x1024",
					},
				},
			},
			completionId: "conversation-1",
			endpoint: "/chat/completions",
			messages: [{ role: "user", content: "hello" } as Message],
			mode: "remote",
			model: "gpt-5",
			models: ["gpt-5", "claude-opus"],
			onProgress: () => {},
			onStateChange: () => {},
			provider: "openai",
			requestOptions: {
				image_generation: {
					size: "1536x1024",
					quality: "high",
				},
			},
			selectedTools: ["image_generation"],
			signal: new AbortController().signal,
			store: true,
			streamingEnabled: true,
			useMultiModel: false,
		});

		const [, request] = fetchMock.mock.calls[0];
		const body = JSON.parse(String(request?.body));

		expect(body.tool_options).toBeUndefined();
		expect(body.options.image_generation).toEqual({
			size: "1536x1024",
			quality: "high",
		});
		expect(body.enabled_tools).toEqual(["image_generation"]);
		expect(body.models).toEqual(["gpt-5", "claude-opus"]);
	});

	it("sends recipe scope with the exact recipe tools", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			createSseResponse([data("[DONE]")]),
		);
		vi.stubGlobal("fetch", fetchMock);

		const service = new ChatService(async () => ({}));

		await service.streamChatCompletions({
			chatSettings: {},
			completionId: "conversation-1",
			endpoint: "/chat/completions",
			messages: [{ role: "user", content: "Set up Gmail" } as Message],
			mode: "remote",
			model: "gpt-5",
			onProgress: () => {},
			onStateChange: () => {},
			requestOptions: {
				recipe: {
					id: "gmail",
					installationId: "installation-1",
					channel: "web",
					allowedConnectorProviders: ["gmail"],
					allowedConnectorOperations: {
						gmail: ["search_messages", "create_draft"],
					},
					configuration: {
						defaultSearch: "newer_than:7d",
					},
				},
			},
			selectedTools: ["use_recipe_connector", "get_recipe", "configure_recipe"],
			signal: new AbortController().signal,
			streamingEnabled: true,
		});

		const [, request] = fetchMock.mock.calls[0];
		const body = JSON.parse(String(request?.body));

		expect(body.enabled_tools).toEqual(["use_recipe_connector", "get_recipe", "configure_recipe"]);
		expect(body.options.recipe).toEqual({
			id: "gmail",
			installationId: "installation-1",
			channel: "web",
			allowedConnectorProviders: ["gmail"],
			allowedConnectorOperations: {
				gmail: ["search_messages", "create_draft"],
			},
			configuration: {
				defaultSearch: "newer_than:7d",
			},
		});
	});

	it("throws streamed provider errors without finalizing an empty assistant message", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				createSseResponse([
					data({
						type: "error",
						error: {
							type: "insufficient_quota",
							code: "insufficient_quota",
							message: "Quota exceeded",
						},
					}),
					data("[DONE]"),
				]),
			),
		);

		const service = new ChatService(async () => ({}));
		const onProgress = vi.fn();

		await expect(
			service.streamChatCompletions({
				chatSettings: {},
				completionId: "conversation-1",
				messages: [{ role: "user", content: "hello" } as Message],
				mode: "remote",
				model: "gpt-5.4-mini",
				onProgress,
				onStateChange: () => {},
				provider: "openai",
				signal: new AbortController().signal,
			}),
		).rejects.toMatchObject({
			code: "insufficient_quota",
			message: "Quota exceeded",
			status: 429,
		});
		expect(onProgress).not.toHaveBeenCalled();
	});
});

describe("ChatService conversation updates", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("updates stored messages through the existing completion update endpoint", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			Response.json({
				data: {
					id: "conversation-1",
					title: "Live notes",
					messages: [
						{
							id: "message-1",
							role: "user",
							content: "Hello",
							timestamp: 1000,
						},
					],
				},
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const service = new ChatService(async () => ({}));
		const messages = JSON.parse(`[
			{
				"id": "message-1",
				"role": "user",
				"content": "Hello",
				"citations": null,
				"timestamp": 1000
			},
			{
				"id": "message-2",
				"role": "assistant",
				"content": "Answer",
				"citations": [
					{
						"url": "https://example.com/source",
						"title": "Example source"
					}
				],
				"timestamp": 1001
			}
		]`);
		const result = await service.updateConversation("conversation-1", {
			messages,
		});

		const [url, request] = fetchMock.mock.calls[0];
		const body = JSON.parse(String(request?.body));

		expect(String(url)).toContain("/chat/completions/conversation-1");
		expect(request?.method).toBe("PUT");
		expect(body.messages[0]).toEqual(
			expect.objectContaining({
				content: "Hello",
				id: "message-1",
				role: "user",
			}),
		);
		expect(body.messages[0]).not.toHaveProperty("citations");
		expect(body.messages[1].citations).toEqual(["https://example.com/source"]);
		expect(result.messages).toEqual([
			expect.objectContaining({
				content: "Hello",
				id: "message-1",
				role: "user",
			}),
		]);
	});
});
