import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHATS_QUERY_KEY } from "~/constants";
import { ChatService } from "~/lib/api/services/chat-service";
import { LoadingProvider } from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";
import type { Conversation, Message } from "~/types";
import { useChatManager } from "../useChatManager";

const mocks = vi.hoisted(() => ({
	generateTitle: vi.fn(),
	getLocalChat: vi.fn(),
	saveLocalChat: vi.fn(),
	streamChatCompletions: vi.fn(),
	updateLocalChatTitle: vi.fn(),
}));

const localChats = vi.hoisted(() => new Map<string, Conversation>());

vi.mock("~/hooks/useModels", () => ({
	useModels: () => ({
		data: {
			"deepseek-v4-flash": {
				id: "deepseek-v4-flash",
				matchingModel: "deepseek-v4-flash",
				name: "DeepSeek Chat",
				provider: "deepseek",
			},
		},
	}),
}));

vi.mock("~/lib/api/api-service", () => ({
	apiService: {
		generateTitle: mocks.generateTitle,
		streamChatCompletions: mocks.streamChatCompletions,
	},
}));

vi.mock("~/lib/local/local-chat-service", () => ({
	localChatService: {
		getLocalChat: mocks.getLocalChat,
		saveLocalChat: mocks.saveLocalChat,
		updateLocalChatTitle: mocks.updateLocalChatTitle,
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

describe("useChatManager", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localChats.clear();
		mocks.getLocalChat.mockImplementation(async (conversationId: string) => {
			return localChats.get(conversationId) ?? null;
		});
		mocks.saveLocalChat.mockImplementation(async (conversation: Conversation) => {
			if (conversation.id) {
				localChats.set(conversation.id, conversation);
			}
		});
		mocks.updateLocalChatTitle.mockImplementation(async (conversationId: string, title: string) => {
			const conversation = localChats.get(conversationId);
			if (conversation) {
				localChats.set(conversationId, { ...conversation, title });
			}
		});
		useChatStore.setState({
			chatMode: "remote",
			chatSettings: {
				localOnly: false,
			} as any,
			currentConversationId: undefined,
			isAuthenticated: false,
			isPro: false,
			localOnlyMode: false,
			locallyCreatedConversationIds: {},
			model: "deepseek-v4-flash",
			selectedAgentId: null,
			useMultiModel: false,
		});
	});

	it("keeps streamed assistant content visible for a new guest conversation", async () => {
		const queryClient = createQueryClient();
		const assistantFinal: Message = {
			id: "assistant-final",
			role: "assistant",
			content: "Hello! How can I help you today?",
			model: "deepseek-v4-flash",
		};
		mocks.streamChatCompletions.mockImplementation(async ({ onProgress }) => {
			onProgress("Hello");
			onProgress("Hello! How");
			onProgress("Hello! How can I help you today?");
			onProgress("Hello! How can I help you today?", undefined, undefined, true, assistantFinal);
			return assistantFinal;
		});

		const { result } = renderHook(() => useChatManager(), {
			wrapper: wrapper(queryClient),
		});

		await act(async () => {
			await result.current.sendMessage("H");
		});

		const conversationId = useChatStore.getState().currentConversationId;
		const conversation = queryClient.getQueryData<Conversation>([CHATS_QUERY_KEY, conversationId]);

		expect(conversation?.messages).toEqual([
			expect.objectContaining({ role: "user", content: "H" }),
			expect.objectContaining({
				id: "assistant-final",
				role: "assistant",
				content: "Hello! How can I help you today?",
			}),
		]);
		expect(localChats.get(conversationId || "")?.messages.at(-1)).toEqual(
			expect.objectContaining({
				id: "assistant-final",
				content: "Hello! How can I help you today?",
			}),
		);
	});

	it("keeps a new guest assistant message visible from a full SSE stream with early metadata", async () => {
		const queryClient = createQueryClient();
		useChatStore.setState({
			model: "auto",
		});
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				createSseResponse([
					data({ state: "init", type: "state" }),
					data({ usage_limits: { daily: { used: 0, limit: 10 } }, type: "usage_limits" }),
					data({
						id: "ebf2e70e-c37c-4ed8-ad42-8129e870a372",
						created: 1782845134201,
						model: "labs-leanstral-2603",
						provider: "mistral",
						platform: "web",
						type: "message_start",
					}),
					data({ state: "thinking", type: "state" }),
					data({ content: "Hello", type: "content_block_delta" }),
					data({ content: "!", type: "content_block_delta" }),
					data({ content: " I", type: "content_block_delta" }),
					data({ content: " see", type: "content_block_delta" }),
					data({ content: " you", type: "content_block_delta" }),
					data({ content: "'ve", type: "content_block_delta" }),
					data({
						content: ' entered "1" \u2014 how can I help you today?',
						type: "content_block_delta",
					}),
					data({ state: "post_processing", type: "state" }),
					data({ type: "content_block_stop" }),
					data({
						id: "ebf2e70e-c37c-4ed8-ad42-8129e870a372",
						message_id: "ee9755be-738d-40d5-be1a-82817b366ce7",
						object: "chat.completion",
						created: 1782845134210,
						model: "labs-leanstral-2603",
						provider: "mistral",
						platform: "web",
						nonce: "f0a4d584-0a1d-4055-8b3f-037e638a4423",
						post_processing: {
							guardrails: { passed: true, error: "", violations: [] },
						},
						log_id: "01KWCXKCH5AQX56BEH1G2NCWMT",
						usage: {
							prompt_tokens: 2144,
							total_tokens: 2163,
							completion_tokens: 19,
							prompt_tokens_details: { cached_tokens: 0 },
						},
						citations: [],
						tool_calls: [],
						finish_reason: "stop",
						data: null,
						parts: [
							{
								type: "text",
								text: 'Hello! I see you\'ve entered "1" \u2014 how can I help you today?',
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

		const { result } = renderHook(() => useChatManager(), {
			wrapper: wrapper(queryClient),
		});

		await act(async () => {
			await result.current.sendMessage("1");
		});

		const conversationId = useChatStore.getState().currentConversationId;
		const conversation = queryClient.getQueryData<Conversation>([CHATS_QUERY_KEY, conversationId]);
		const expectedAssistantText =
			'Hello! I see you\'ve entered "1" \u2014 how can I help you today?';

		expect(conversation?.messages).toEqual([
			expect.objectContaining({ role: "user", content: "1" }),
			expect.objectContaining({
				id: "ee9755be-738d-40d5-be1a-82817b366ce7",
				role: "assistant",
				content: expectedAssistantText,
				model: "labs-leanstral-2603",
			}),
		]);
		expect(localChats.get(conversationId || "")?.messages.at(-1)).toEqual(
			expect.objectContaining({
				id: "ee9755be-738d-40d5-be1a-82817b366ce7",
				content: expectedAssistantText,
			}),
		);
	});
});
