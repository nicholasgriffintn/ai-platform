import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHATS_QUERY_KEY } from "~/constants";
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
});
