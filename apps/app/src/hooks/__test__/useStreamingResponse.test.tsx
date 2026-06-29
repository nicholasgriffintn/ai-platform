import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHATS_QUERY_KEY } from "~/constants";
import { LoadingProvider } from "~/state/contexts/LoadingContext";
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
});
