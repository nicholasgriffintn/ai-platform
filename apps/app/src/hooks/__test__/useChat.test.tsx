import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHATS_QUERY_KEY } from "~/constants";
import { useChatStore } from "~/state/stores/chatStore";
import type { Conversation } from "~/types";
import { useChat } from "../useChat";

const mocks = vi.hoisted(() => ({
	getChat: vi.fn(),
	getLocalChat: vi.fn(),
}));

vi.mock("~/lib/api/api-service", () => ({
	apiService: {
		getChat: mocks.getChat,
	},
}));

vi.mock("~/lib/local/local-chat-service", () => ({
	localChatService: {
		getLocalChat: mocks.getLocalChat,
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
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}

describe("useChat", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getLocalChat.mockResolvedValue(null);
		useChatStore.setState({
			isAuthenticated: true,
			isPro: true,
			localOnlyMode: false,
			locallyCreatedConversationIds: {},
		});
	});

	it("does not fetch a remote chat for a client-created conversation id", async () => {
		const queryClient = createQueryClient();
		useChatStore.setState({
			locallyCreatedConversationIds: {
				"conversation-1": true,
			},
		});

		const { result } = renderHook(() => useChat("conversation-1"), {
			wrapper: wrapper(queryClient),
		});

		await waitFor(() => expect(result.current.data).toBeNull());

		expect(mocks.getLocalChat).toHaveBeenCalledWith("conversation-1");
		expect(mocks.getChat).not.toHaveBeenCalled();
	});

	it("keeps optimistic messages when a new remote conversation is not found", async () => {
		const queryClient = createQueryClient();
		let rejectRemoteChat: (error: Error) => void = () => {};
		mocks.getChat.mockReturnValue(
			new Promise((_resolve, reject) => {
				rejectRemoteChat = reject;
			}),
		);
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

		const { result } = renderHook(() => useChat("conversation-1"), {
			wrapper: wrapper(queryClient),
		});

		await waitFor(() => expect(mocks.getChat).toHaveBeenCalled());

		const optimisticConversation: Conversation = {
			id: "conversation-1",
			title: "New conversation",
			isLocalOnly: false,
			messages: [
				{
					id: "user-1",
					role: "user",
					content: "hi",
				},
			],
		};
		queryClient.setQueryData([CHATS_QUERY_KEY, "conversation-1"], optimisticConversation);
		rejectRemoteChat(new Error("Failed to get chat: Not Found"));

		await waitFor(() => expect(result.current.data).toBe(optimisticConversation));

		consoleError.mockRestore();
	});
});
