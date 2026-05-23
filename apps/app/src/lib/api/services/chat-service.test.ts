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
		const duplicateToolResponse = {
			type: "tool_response",
			tool_id: "tool-result-1",
			result: {
				role: "tool",
				id: "tool-result-1",
				name: "web_search",
				content: "Web search completed",
				status: "success",
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
						parts: [{ type: "text", text: "First turn", timestamp: 1000 }],
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

		const result = await service.streamChatCompletions(
			"conversation-1",
			[{ role: "user", content: "hello" } as Message],
			"test-model",
			undefined,
			"remote",
			{},
			new AbortController().signal,
			(_text, _reasoning, toolResponses, _done, assistantMessage) => {
				if (assistantMessage) {
					assistantMessages.push(assistantMessage);
				}
				if (toolResponses) {
					toolMessages.push(...toolResponses);
				}
			},
			() => {},
		);

		expect(assistantMessages.map((message) => message.id)).toEqual(["assistant-1", "assistant-2"]);
		expect(assistantMessages.map((message) => message.content)).toEqual([
			"First turn",
			"Second turn",
		]);
		expect(toolMessages).toHaveLength(1);
		expect(result.id).toBe("assistant-2");
		expect(result.content).toBe("Second turn");
	});

	it("sends provider options inside request options", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			createSseResponse([data("[DONE]")]),
		);
		vi.stubGlobal("fetch", fetchMock);

		const service = new ChatService(async () => ({}));

		await service.streamChatCompletions(
			"conversation-1",
			[{ role: "user", content: "hello" } as Message],
			"gpt-5",
			"openai",
			"remote",
			{
				tool_options: {
					image_generation: {
						size: "1024x1024",
					},
				},
			},
			new AbortController().signal,
			() => {},
			() => {},
			true,
			true,
			false,
			"/chat/completions",
			["image_generation"],
			{
				image_generation: {
					size: "1536x1024",
					quality: "high",
				},
			},
		);

		const [, request] = fetchMock.mock.calls[0];
		const body = JSON.parse(String(request?.body));

		expect(body.tool_options).toBeUndefined();
		expect(body.options.image_generation).toEqual({
			size: "1536x1024",
			quality: "high",
		});
		expect(body.enabled_tools).toEqual(["image_generation"]);
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
			service.streamChatCompletions(
				"conversation-1",
				[{ role: "user", content: "hello" } as Message],
				"gpt-5.4-mini",
				"openai",
				"remote",
				{},
				new AbortController().signal,
				onProgress,
				() => {},
			),
		).rejects.toMatchObject({
			code: "insufficient_quota",
			message: "Quota exceeded",
			status: 429,
		});
		expect(onProgress).not.toHaveBeenCalled();
	});
});
