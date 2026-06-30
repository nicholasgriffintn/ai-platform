import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHATS_QUERY_KEY } from "~/constants";
import { LoadingProvider } from "~/state/contexts/LoadingContext";
import { ChatService } from "~/lib/api/services/chat-service";
import { useChatStore } from "~/state/stores/chatStore";
import type { Conversation, Message } from "~/types";
import { useStreamingResponse } from "../useStreamingResponse";

const mocks = vi.hoisted(() => ({
	fetchModels: vi.fn(),
	streamChatCompletions: vi.fn(),
}));

vi.mock("~/lib/api/api-service", () => ({
	apiService: {
		fetchModels: mocks.fetchModels,
		streamChatCompletions: mocks.streamChatCompletions,
	},
}));

function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});
}

function wrapper(queryClient: QueryClient) {
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>
			<LoadingProvider>{children}</LoadingProvider>
		</QueryClientProvider>
	);
}

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

describe("useStreamingResponse", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fetchModels.mockResolvedValue({});
		useChatStore.setState({
			chatMode: "remote",
			chatSettings: {
				localOnly: false,
			} as any,
			isAuthenticated: true,
			isPro: true,
			localOnlyMode: false,
			locallyCreatedConversationIds: {},
			model: "deepseek-v4-flash",
			selectedAgentId: null,
			useMultiModel: false,
		});
	});

	it("returns and persists streamed assistant/tool messages in provider replay order", async () => {
		const queryClient = createQueryClient();
		const userMessage: Message = {
			id: "user-1",
			role: "user",
			content: "What is Polychat?",
			model: "deepseek-v4-flash",
		};
		queryClient.setQueryData<Conversation>([CHATS_QUERY_KEY, "conversation-1"], {
			id: "conversation-1",
			title: "Test",
			isLocalOnly: false,
			messages: [userMessage],
		});

		const assistantToolCall: Message = {
			id: "assistant-tool-call",
			role: "assistant",
			content: "I will search for that.",
			model: "deepseek-v4-flash",
			tool_calls: [
				{
					id: "call_search",
					type: "function",
					function: {
						name: "web_search",
						arguments: '{"query":"Polychat"}',
					},
				},
			],
		};
		const toolResult: Message = {
			id: "tool-1",
			role: "tool",
			name: "web_search",
			content: "Search completed",
			status: "success",
			tool_call_id: "call_search",
		};
		const assistantFinal: Message = {
			id: "assistant-final",
			role: "assistant",
			content: "Polychat is a chat product.",
			model: "deepseek-v4-flash",
		};

		mocks.streamChatCompletions.mockImplementation(async ({ onProgress }) => {
			onProgress("", undefined, undefined, true, assistantToolCall);
			onProgress("", "", [toolResult]);
			onProgress("Polychat is a chat product.");
			onProgress("", undefined, undefined, true, assistantFinal);
			return assistantFinal;
		});

		const { result } = renderHook(() => useStreamingResponse(undefined), {
			wrapper: wrapper(queryClient),
		});

		let streamResult: Awaited<ReturnType<typeof result.current.streamResponse>> | undefined;
		await act(async () => {
			streamResult = await result.current.streamResponse(
				[userMessage],
				"conversation-1",
				undefined,
				{ generateTitle: false },
			);
		});

		expect(streamResult?.message).toEqual(expect.objectContaining({ id: "assistant-final" }));
		expect(streamResult?.messages?.map((message) => message.id)).toEqual([
			"assistant-tool-call",
			"tool-1",
			"assistant-final",
		]);
		expect(streamResult?.toolResponses?.map((message) => message.id)).toEqual(["tool-1"]);

		const conversation = queryClient.getQueryData<Conversation>([
			CHATS_QUERY_KEY,
			"conversation-1",
		]);
		expect(conversation?.messages.map((message) => message.id)).toEqual([
			"user-1",
			"assistant-tool-call",
			"tool-1",
			"assistant-final",
		]);
	});

	it("marks a locally-created conversation as remote after a stored stream succeeds", async () => {
		const queryClient = createQueryClient();
		const userMessage: Message = {
			id: "user-1",
			role: "user",
			content: "hello",
			model: "deepseek-v4-flash",
		};
		queryClient.setQueryData<Conversation>([CHATS_QUERY_KEY, "conversation-1"], {
			id: "conversation-1",
			title: "Test",
			isLocalOnly: false,
			messages: [userMessage],
		});
		useChatStore.setState({
			locallyCreatedConversationIds: {
				"conversation-1": true,
			},
		});

		const assistantFinal: Message = {
			id: "assistant-final",
			role: "assistant",
			content: "Hi.",
			model: "deepseek-v4-flash",
		};
		mocks.streamChatCompletions.mockResolvedValue(assistantFinal);

		const { result } = renderHook(() => useStreamingResponse(undefined), {
			wrapper: wrapper(queryClient),
		});

		await act(async () => {
			await result.current.streamResponse([userMessage], "conversation-1", undefined, {
				generateTitle: false,
			});
		});

		expect(useChatStore.getState().locallyCreatedConversationIds["conversation-1"]).toBeUndefined();
	});

	it("updates local guest conversations from streamed content deltas", async () => {
		const queryClient = createQueryClient();
		const userMessage: Message = {
			id: "user-1",
			role: "user",
			content: "A",
			model: "deepseek-v4-flash",
		};
		queryClient.setQueryData<Conversation>([CHATS_QUERY_KEY, "conversation-1"], {
			id: "conversation-1",
			title: "A",
			isLocalOnly: true,
			messages: [userMessage],
		});
		useChatStore.setState({
			isAuthenticated: false,
			isPro: false,
			localOnlyMode: false,
		});

		const assistantFinal: Message = {
			id: "assistant-final",
			role: "assistant",
			content: "Hello! How can I help?",
			model: "deepseek-v4-flash",
		};
		mocks.streamChatCompletions.mockImplementation(async ({ onProgress }) => {
			onProgress("Hello");
			onProgress("Hello!");
			onProgress("Hello! How can I help?");
			onProgress("Hello! How can I help?", undefined, undefined, true, assistantFinal);
			return assistantFinal;
		});

		const { result } = renderHook(() => useStreamingResponse(undefined), {
			wrapper: wrapper(queryClient),
		});

		await act(async () => {
			await result.current.streamResponse([userMessage], "conversation-1", undefined, {
				generateTitle: false,
			});
		});

		const conversation = queryClient.getQueryData<Conversation>([
			CHATS_QUERY_KEY,
			"conversation-1",
		]);
		expect(conversation?.isLocalOnly).toBe(true);
		expect(conversation?.messages).toEqual([
			expect.objectContaining({ id: "user-1", content: "A" }),
			expect.objectContaining({
				id: "assistant-final",
				role: "assistant",
				content: "Hello! How can I help?",
			}),
		]);
	});

	it("updates the active placeholder with early assistant metadata", async () => {
		const queryClient = createQueryClient();
		const userMessage: Message = {
			id: "user-1",
			role: "user",
			content: "Pick a model",
			model: "auto",
		};
		queryClient.setQueryData<Conversation>([CHATS_QUERY_KEY, "conversation-1"], {
			id: "conversation-1",
			title: "Pick a model",
			isLocalOnly: false,
			messages: [userMessage],
		});
		useChatStore.setState({
			model: "auto",
		});

		const assistantFinal: Message = {
			id: "assistant-final",
			role: "assistant",
			content: "Chosen.",
			model: "router-selected-model",
			provider: "mistral",
		};
		mocks.streamChatCompletions.mockImplementation(async ({ onProgress }) => {
			onProgress("", undefined, undefined, false, {
				id: "assistant-early",
				role: "assistant",
				content: "",
				model: "router-selected-model",
				provider: "mistral",
			});

			await waitFor(() => {
				const conversation = queryClient.getQueryData<Conversation>([
					CHATS_QUERY_KEY,
					"conversation-1",
				]);
				expect(conversation?.messages[1]).toEqual(
					expect.objectContaining({
						role: "assistant",
						content: "",
						model: "router-selected-model",
						provider: "mistral",
					}),
				);
			});

			onProgress("Choosing a model...");
			await waitFor(() => {
				const conversation = queryClient.getQueryData<Conversation>([
					CHATS_QUERY_KEY,
					"conversation-1",
				]);
				expect(conversation?.messages[1]).toEqual(
					expect.objectContaining({
						role: "assistant",
						content: "Choosing a model...",
						model: "router-selected-model",
						provider: "mistral",
					}),
				);
			});

			onProgress("Chosen.", undefined, undefined, true, assistantFinal);
			return assistantFinal;
		});

		const { result } = renderHook(() => useStreamingResponse(undefined), {
			wrapper: wrapper(queryClient),
		});

		await act(async () => {
			await result.current.streamResponse([userMessage], "conversation-1", undefined, {
				generateTitle: false,
			});
		});

		const conversation = queryClient.getQueryData<Conversation>([
			CHATS_QUERY_KEY,
			"conversation-1",
		]);
		expect(conversation?.messages[1]).toEqual(
			expect.objectContaining({
				id: "assistant-final",
				content: "Chosen.",
				model: "router-selected-model",
				provider: "mistral",
			}),
		);
	});

	it("persists guest assistant messages from full SSE streams with early metadata", async () => {
		const queryClient = createQueryClient();
		const userMessage: Message = {
			id: "user-1",
			role: "user",
			content: "1",
			model: "labs-leanstral-2603",
		};
		queryClient.setQueryData<Conversation>([CHATS_QUERY_KEY, "conversation-1"], {
			id: "conversation-1",
			title: "1",
			isLocalOnly: true,
			messages: [userMessage],
		});
		useChatStore.setState({
			isAuthenticated: false,
			isPro: false,
			localOnlyMode: false,
			model: "auto",
		});

		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				createSseResponse([
					data({ state: "init", type: "state" }),
					data({ usage_limits: { daily: { used: 0, limit: 10 } }, type: "usage_limits" }),
					data({
						id: "conversation-1",
						created: 1782845134201,
						model: "labs-leanstral-2603",
						provider: "mistral",
						platform: "web",
						type: "message_start",
					}),
					data({ state: "thinking", type: "state" }),
					data({ content: "Hello", type: "content_block_delta" }),
					data({ content: "!", type: "content_block_delta" }),
					data({ content: " I see you", type: "content_block_delta" }),
					data({ state: "post_processing", type: "state" }),
					data({ type: "content_block_stop" }),
					data({
						id: "conversation-1",
						message_id: "assistant-final",
						object: "chat.completion",
						created: 1782845134210,
						model: "labs-leanstral-2603",
						provider: "mistral",
						platform: "web",
						nonce: "nonce",
						post_processing: {
							guardrails: { passed: true, error: "", violations: [] },
						},
						log_id: "log-id",
						usage: {
							prompt_tokens: 2144,
							total_tokens: 2163,
							completion_tokens: 19,
						},
						citations: [],
						tool_calls: [],
						finish_reason: "stop",
						data: null,
						parts: [
							{
								type: "text",
								text: "Hello! I see you",
								timestamp: 1782845134203,
							},
						],
						type: "message_delta",
					}),
					data({ type: "message_stop" }),
					data({ usage_limits: { daily: { used: 0, limit: 10 } }, type: "usage_limits" }),
					data({ state: "done", type: "state" }),
					data("[DONE]"),
				]),
			),
		);
		mocks.streamChatCompletions.mockImplementation((params) =>
			new ChatService(async () => ({})).streamChatCompletions(params),
		);

		const { result } = renderHook(() => useStreamingResponse(undefined), {
			wrapper: wrapper(queryClient),
		});

		await act(async () => {
			await result.current.streamResponse([userMessage], "conversation-1", undefined, {
				generateTitle: false,
			});
		});

		const conversation = queryClient.getQueryData<Conversation>([
			CHATS_QUERY_KEY,
			"conversation-1",
		]);
		expect(conversation?.messages).toEqual([
			expect.objectContaining({ id: "user-1", content: "1" }),
			expect.objectContaining({
				id: "assistant-final",
				role: "assistant",
				content: "Hello! I see you",
				model: "labs-leanstral-2603",
			}),
		]);
	});
});
