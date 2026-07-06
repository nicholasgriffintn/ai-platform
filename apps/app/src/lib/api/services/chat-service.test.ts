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

	it("does not send chat completion requests when compaction filtering leaves no provider messages", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const service = new ChatService(async () => ({ Authorization: "Bearer token" }));

		await expect(
			service.streamChatCompletions({
				chatSettings: {},
				completionId: "conversation-1",
				messages: [
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
					} as Message,
				],
				mode: "remote",
				model: "gpt-5.4-mini",
				onProgress: () => {},
				onStateChange: () => {},
				provider: "openai",
				signal: new AbortController().signal,
			}),
		).rejects.toThrow("Missing required parameter: messages");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("normalises stored conversation responses with missing messages", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			Response.json({
				data: {
					id: "conversation-1",
					title: "Recovered conversation",
					is_public: true,
					share_id: "share-1",
				},
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const service = new ChatService(async () => ({ Authorization: "Bearer token" }));

		const result = await service.getChat("conversation-1");

		expect(result).toEqual(
			expect.objectContaining({
				id: "conversation-1",
				title: "Recovered conversation",
				messages: [],
				is_public: true,
				share_id: "share-1",
			}),
		);
	});

	it("accepts compact responses containing stored database message rows", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							success: true,
							data: {
								compacted: true,
								conversation: {
									id: "conversation-1",
									title: "Decade of Meme Evolution",
									is_archived: 0,
									user_id: 1,
									messages: [
										{
											id: "msg-0",
											conversation_id: "conversation-1",
											parent_message_id: null,
											role: "user",
											content: "Write a humorous commentary on memes.",
											name: null,
											tool_calls: null,
											citations: null,
											model: "deepseek-v4-pro",
											status: null,
											timestamp: 1783110478964,
											platform: "web",
											mode: "remote",
											log_id: null,
											data: null,
											created_at: "2026-07-03 20:27:59",
											updated_at: "2026-07-03 20:28:55",
											parts: [
												{
													timestamp: 1783110478964,
													type: "text",
													text: "Write a humorous commentary on memes.",
												},
											],
											tool_call_id: null,
											app: null,
											tool_call_arguments: null,
											is_archived: 1,
										},
										{
											id: "msg-0-compaction",
											conversation_id: "conversation-1",
											parent_message_id: null,
											role: "compaction",
											content: "Context compacted",
											name: null,
											tool_calls: null,
											citations: null,
											model: null,
											status: null,
											timestamp: 1783110534616,
											platform: "api",
											mode: "remote",
											log_id: null,
											data: null,
											created_at: "2026-07-03 20:28:55",
											updated_at: "2026-07-03 20:28:55",
											parts: [
												{
													timestamp: 1783110534616,
													type: "compaction",
													status: "completed",
													label: "Context compacted",
												},
											],
											tool_call_id: null,
											app: null,
											tool_call_arguments: null,
											is_archived: 1,
										},
									],
								},
							},
						}),
						{
							headers: {
								"Content-Type": "application/json",
							},
						},
					),
			),
		);

		const service = new ChatService(async () => ({ Authorization: "Bearer token" }));

		await expect(service.compactConversation("conversation-1")).resolves.toMatchObject({
			compacted: true,
			conversation: {
				id: "conversation-1",
				messages: [
					expect.objectContaining({
						id: "msg-0",
						content: "Write a humorous commentary on memes.",
					}),
					expect.objectContaining({
						id: "msg-0-compaction",
						role: "compaction",
						content: "Context compacted",
						parts: [
							expect.objectContaining({
								type: "compaction",
								status: "completed",
							}),
						],
					}),
				],
			},
		});
	});

	it("rejects compacted endpoint responses without a visible compaction marker", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							success: true,
							data: {
								compacted: true,
								conversation: {
									id: "conversation-1",
									title: "Wine bottle ideas",
									messages: [
										{
											id: "assistant-1",
											role: "assistant",
											content: "Previous answer",
										},
									],
								},
							},
						}),
						{
							headers: {
								"Content-Type": "application/json",
							},
						},
					),
			),
		);

		const service = new ChatService(async () => ({ Authorization: "Bearer token" }));

		await expect(service.compactConversation("conversation-1")).rejects.toThrow(
			"Invalid compact conversation response",
		);
	});

	it("emits compaction state metadata from non-streaming completion responses", async () => {
		const compactionMessage = {
			id: "snapshot-1-compaction",
			role: "compaction",
			content: "Context automatically compacted",
			parts: [
				{
					type: "compaction",
					status: "completed",
					label: "Context automatically compacted",
				},
			],
		};
		const fetchMock = vi.fn(
			async (_input: RequestInfo | URL, _init?: RequestInit) =>
				new Response(
					JSON.stringify({
						success: true,
						data: {
							id: "completion-response-1",
							created: 1_000,
							model: "test-model",
							choices: [
								{
									index: 0,
									message: {
										role: "assistant",
										content: "Done",
									},
									finish_reason: "stop",
								},
							],
							post_processing: {
								compaction: {
									message: compactionMessage,
								},
							},
						},
					}),
					{
						headers: {
							"Content-Type": "application/json",
						},
					},
				),
		);
		vi.stubGlobal("fetch", fetchMock);

		const onStateChange = vi.fn();
		const service = new ChatService(async () => ({ Authorization: "Bearer token" }));

		const result = await service.streamChatCompletions({
			chatSettings: {},
			completionId: "conversation-1",
			messages: [{ role: "user", content: "hello" } as Message],
			mode: "remote",
			model: "test-model",
			onProgress: () => {},
			onStateChange,
			signal: new AbortController().signal,
			streamingEnabled: false,
		});

		expect(result).toEqual(
			expect.objectContaining({
				id: "completion-response-1",
				role: "assistant",
				content: "Done",
			}),
		);
		expect(onStateChange).toHaveBeenCalledWith("compaction", {
			type: "state",
			state: "compaction",
			message: compactionMessage,
		});
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
			chatSettings: {
				tool_options: {
					image_generation: {
						size: "1536x1024",
						quality: "high",
					},
				},
			},
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

	it("loads CRLF-delimited content deltas and finalises when the stream closes without done", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				createSseResponse([
					`data: {"state":"init","type":"state"}\r\n\r\n`,
					`data: {"usage_limits":{"daily":{"used":0,"limit":50}},"type":"usage_limits"}\r\n\r\n`,
					`data: {"state":"thinking","type":"state"}\r\n\r\n`,
					`data: {"content":"<answer","type":"content_block_delta"}\r\n\r\n`,
					`data: {"content":">\\nI will check the weather for London W5 1EW at 09:00 today.","type":"content_block_delta"}`,
				]),
			),
		);

		const progressUpdates: string[] = [];
		const states: string[] = [];
		const service = new ChatService(async () => ({}));

		const result = await service.streamChatCompletions({
			chatSettings: {},
			completionId: "conversation-1",
			messages: [{ role: "user", content: "hello" } as Message],
			mode: "remote",
			model: "test-model",
			onProgress: (text) => {
				progressUpdates.push(text);
			},
			onStateChange: (state) => {
				states.push(state);
			},
			signal: new AbortController().signal,
		});

		expect(states).toEqual(["init", "usage_limits", "thinking"]);
		expect(progressUpdates).toContain("<answer");
		expect(progressUpdates.at(-1)).toBe(
			"I will check the weather for London W5 1EW at 09:00 today.",
		);
		expect(result.content).toBe("I will check the weather for London W5 1EW at 09:00 today.");
	});

	it("loads raw Anthropic text deltas when provider-shaped events reach the client", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				createSseResponse([
					`event: message_start\ndata: ${JSON.stringify({
						type: "message_start",
						message: {
							id: "msg-anthropic",
							model: "claude-opus-4-8",
							role: "assistant",
							content: [],
						},
					})}\n\n`,
					`event: content_block_start\ndata: ${JSON.stringify({
						type: "content_block_start",
						index: 0,
						content_block: { type: "text", text: "" },
					})}\n\n`,
					`event: content_block_delta\ndata: ${JSON.stringify({
						type: "content_block_delta",
						index: 0,
						delta: { type: "text_delta", text: "I'll create " },
					})}\n\n`,
					`event: content_block_delta\ndata: ${JSON.stringify({
						type: "content_block_delta",
						index: 0,
						delta: { type: "text_delta", text: "an orbit visualization." },
					})}\n\n`,
					`event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`,
					data("[DONE]"),
				]),
			),
		);

		const progressUpdates: string[] = [];
		const service = new ChatService(async () => ({}));

		const result = await service.streamChatCompletions({
			chatSettings: {},
			completionId: "conversation-1",
			messages: [{ role: "user", content: "show me orbit" } as Message],
			mode: "remote",
			model: "claude-opus-4-8",
			onProgress: (text) => {
				progressUpdates.push(text);
			},
			onStateChange: () => {},
			signal: new AbortController().signal,
		});

		expect(progressUpdates).toContain("I'll create an orbit visualization.");
		expect(result).toMatchObject({
			id: "msg-anthropic",
			model: "claude-opus-4-8",
			content: "I'll create an orbit visualization.",
		});
	});

	it("keeps streamed text when final metadata omits content and usable parts", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				createSseResponse([
					data({ type: "state", state: "init" }),
					data({ type: "content_block_delta", content: "Hello" }),
					data({ type: "content_block_delta", content: "!" }),
					data({ type: "content_block_delta", content: " How" }),
					data({ type: "content_block_delta", content: " can" }),
					data({ type: "content_block_delta", content: " I" }),
					data({ type: "content_block_delta", content: " help" }),
					data({ type: "content_block_delta", content: " you" }),
					data({ type: "content_block_delta", content: " today" }),
					data({ type: "content_block_delta", content: "?" }),
					data({ type: "state", state: "post_processing" }),
					data({ type: "content_block_stop" }),
					data({
						type: "message_delta",
						id: "conversation-1",
						message_id: "assistant-final",
						created: 1000,
						model: "deepseek-v4-flash",
						parts: [{ type: "text", text: "" }],
					}),
					data({ type: "message_stop" }),
					data({ type: "usage_limits", usage_limits: { daily: { used: 5, limit: 10 } } }),
					data({ type: "state", state: "done" }),
					data("[DONE]"),
				]),
			),
		);

		const progressUpdates: string[] = [];
		const service = new ChatService(async () => ({}));

		const result = await service.streamChatCompletions({
			chatSettings: {},
			completionId: "conversation-1",
			messages: [{ role: "user", content: "H" } as Message],
			mode: "remote",
			model: "deepseek-v4-flash",
			onProgress: (text) => {
				progressUpdates.push(text);
			},
			onStateChange: () => {},
			signal: new AbortController().signal,
		});

		expect(progressUpdates).toContain("Hello! How can I help you today?");
		expect(result).toEqual(
			expect.objectContaining({
				id: "assistant-final",
				content: "Hello! How can I help you today?",
			}),
		);
	});

	it("surfaces streamed usage limits through state updates", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				createSseResponse([
					data({
						type: "usage_limits",
						usage_limits: {
							daily: {
								used: 10,
								limit: 10,
							},
						},
					}),
					data({ type: "state", state: "done" }),
					data("[DONE]"),
				]),
			),
		);

		const stateUpdates: Array<{ state: string; data?: unknown }> = [];
		const service = new ChatService(async () => ({}));

		await service.streamChatCompletions({
			chatSettings: {},
			completionId: "conversation-1",
			messages: [{ role: "user", content: "hello" } as Message],
			mode: "remote",
			model: "test-model",
			onProgress: () => {},
			onStateChange: (state, data) => {
				stateUpdates.push({ state, data });
			},
			signal: new AbortController().signal,
		});

		expect(stateUpdates).toContainEqual({
			state: "usage_limits",
			data: {
				daily: {
					used: 10,
					limit: 10,
				},
			},
		});
	});

	it("sends hosted tool settings in top-level tool_options", async () => {
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
			selectedTools: ["image_generation"],
			signal: new AbortController().signal,
			store: true,
			streamingEnabled: true,
			useMultiModel: false,
		});

		const [, request] = fetchMock.mock.calls[0];
		const body = JSON.parse(String(request?.body));

		expect(body.options?.tool_options).toBeUndefined();
		expect(body.tool_options.image_generation).toEqual({
			size: "1024x1024",
		});
		expect(body.enabled_tools).toEqual(["image_generation"]);
		expect(body.models).toEqual(["gpt-5", "claude-opus"]);
		expect(body.provider).toBe("openai");
	});

	it("omits tool request fields when tools are not allowed", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			createSseResponse([data("[DONE]")]),
		);
		vi.stubGlobal("fetch", fetchMock);

		const service = new ChatService(async () => ({}));

		await service.streamChatCompletions({
			allowTools: false,
			chatSettings: {
				enabled_tools: ["web_search"],
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
			onProgress: () => {},
			onStateChange: () => {},
			requestOptions: {
				options: {
					sandbox: {
						enabled: true,
						taskType: "bug-fix",
						maxSteps: 4,
					},
				},
			},
			selectedTools: ["image_generation"],
			signal: new AbortController().signal,
			streamingEnabled: true,
		});

		const [, request] = fetchMock.mock.calls[0];
		const body = JSON.parse(String(request?.body));

		expect(body.enabled_tools).toBeUndefined();
		expect(body.approved_tools).toBeUndefined();
		expect(body.tool_options).toBeUndefined();
		expect(body.max_steps).toBeUndefined();
	});

	it("sends automatic router mode without an explicit model", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			createSseResponse([data("[DONE]")]),
		);
		vi.stubGlobal("fetch", fetchMock);

		const service = new ChatService(async () => ({}));

		await service.streamChatCompletions({
			chatSettings: {},
			completionId: "conversation-1",
			endpoint: "/chat/completions",
			messages: [{ role: "user", content: "hello" } as Message],
			mode: "remote",
			modelRouterMode: "pro",
			onProgress: () => {},
			onStateChange: () => {},
			signal: new AbortController().signal,
		});

		const [, request] = fetchMock.mock.calls[0];
		const body = JSON.parse(String(request?.body));

		expect(body.model).toBeUndefined();
		expect(body.model_router_mode).toBe("pro");
	});

	it("sends chat compaction policy from chat settings", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			createSseResponse([data("[DONE]")]),
		);
		vi.stubGlobal("fetch", fetchMock);

		const service = new ChatService(async () => ({}));

		await service.streamChatCompletions({
			chatSettings: {
				compaction: "off",
			},
			completionId: "conversation-1",
			endpoint: "/chat/completions",
			messages: [{ role: "user", content: "hello" } as Message],
			mode: "remote",
			model: "gpt-5",
			onProgress: () => {},
			onStateChange: () => {},
			signal: new AbortController().signal,
		});

		const [, request] = fetchMock.mock.calls[0];
		const body = JSON.parse(String(request?.body));

		expect(body.compaction).toBe("off");
	});

	it("drops invalid persisted chat compaction settings from chat requests", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			createSseResponse([data("[DONE]")]),
		);
		vi.stubGlobal("fetch", fetchMock);

		const service = new ChatService(async () => ({}));

		const chatSettings = JSON.parse('{"compaction":"manual"}');

		await service.streamChatCompletions({
			chatSettings,
			completionId: "conversation-1",
			endpoint: "/chat/completions",
			messages: [{ role: "user", content: "hello" } as Message],
			mode: "remote",
			model: "gpt-5",
			onProgress: () => {},
			onStateChange: () => {},
			signal: new AbortController().signal,
		});

		const [, request] = fetchMock.mock.calls[0];
		const body = JSON.parse(String(request?.body));

		expect(body.compaction).toBeUndefined();
	});

	it("omits empty optional settings objects from chat requests", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			createSseResponse([data("[DONE]")]),
		);
		vi.stubGlobal("fetch", fetchMock);

		const service = new ChatService(async () => ({}));

		await service.streamChatCompletions({
			chatSettings: {
				rag_options: {},
				tool_options: {},
			},
			completionId: "conversation-1",
			endpoint: "/chat/completions",
			messages: [{ role: "user", content: "hello" } as Message],
			mode: "remote",
			model: "gpt-5",
			onProgress: () => {},
			onStateChange: () => {},
			signal: new AbortController().signal,
		});

		const [, request] = fetchMock.mock.calls[0];
		const body = JSON.parse(String(request?.body));

		expect(body.rag_options).toBeUndefined();
		expect(body.tool_options).toBeUndefined();
	});

	it("normalises selected tool ids before sending chat requests", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			createSseResponse([data("[DONE]")]),
		);
		vi.stubGlobal("fetch", fetchMock);

		const service = new ChatService(async () => ({}));

		await service.streamChatCompletions({
			chatSettings: {},
			completionId: "conversation-1",
			endpoint: "/chat/completions",
			messages: [{ role: "user", content: "hello" } as Message],
			mode: "remote",
			model: "gpt-5",
			onProgress: () => {},
			onStateChange: () => {},
			selectedTools: ["web_fetch", "bad tool", "web_fetch"],
			signal: new AbortController().signal,
			streamingEnabled: true,
		});

		const [, request] = fetchMock.mock.calls[0];
		const body = JSON.parse(String(request?.body));

		expect(body.enabled_tools).toEqual(["web_fetch"]);
		expect(body.options?.enabled_tools).toBeUndefined();
	});

	it("does not send stale hosted model tools that are unavailable for the selected model", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			createSseResponse([data("[DONE]")]),
		);
		vi.stubGlobal("fetch", fetchMock);

		const service = new ChatService(async () => ({}));

		await service.streamChatCompletions({
			chatSettings: {},
			completionId: "conversation-1",
			endpoint: "/chat/completions",
			messages: [{ role: "user", content: "hello" } as Message],
			mode: "remote",
			model: "deepseek-v4-flash",
			modelConfig: {
				id: "deepseek-v4-flash",
				matchingModel: "deepseek-v4-flash",
				name: "DeepSeek Chat",
				provider: "deepseek",
				supportsToolCalls: true,
				supportsWebFetch: false,
			},
			onProgress: () => {},
			onStateChange: () => {},
			selectedTools: ["web_search", "web_fetch", "file_search"],
			signal: new AbortController().signal,
			streamingEnabled: true,
		});

		const [, request] = fetchMock.mock.calls[0];
		const body = JSON.parse(String(request?.body));

		expect(body.enabled_tools).toEqual(["web_search"]);
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
				options: {
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

describe("ChatService conversation list", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("encodes title search, sorting, archive filter, and pagination in the list request", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			Response.json({
				data: {
					conversations: [
						{
							id: "conversation-1",
							title: "Design review",
							messages: ["message-1"],
							created_at: "2026-06-20T10:00:00.000Z",
							updated_at: "2026-06-22T10:00:00.000Z",
							last_message_at: "2026-06-22T10:00:00.000Z",
							is_archived: true,
						},
					],
					pageNumber: 2,
					pageSize: 30,
					totalPages: 4,
				},
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const service = new ChatService(async () => ({}));
		const result = await service.listChats({
			archived: "archived",
			limit: 30,
			page: 2,
			query: "design review",
			sortBy: "created",
		});

		const [url, request] = fetchMock.mock.calls[0];

		expect(String(url)).toContain(
			"/chat/completions?limit=30&page=2&archived=archived&sort_by=created&q=design+review",
		);
		expect(request?.method).toBe("GET");
		expect(result.conversations).toEqual([
			expect.objectContaining({
				id: "conversation-1",
				is_archived: true,
				message_ids: ["message-1"],
				messages: [],
				title: "Design review",
			}),
		]);
		expect(result.totalPages).toBe(4);
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
