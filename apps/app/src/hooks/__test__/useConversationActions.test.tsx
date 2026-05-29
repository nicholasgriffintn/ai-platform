import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHATS_QUERY_KEY } from "~/constants";
import { apiService } from "~/lib/api/api-service";
import { useChatStore } from "~/state/stores/chatStore";
import type { Conversation } from "~/types";
import { useConversationActions } from "../useConversationActions";

vi.mock("~/lib/api/api-service", () => ({
	apiService: {
		updateConversation: vi.fn(),
	},
}));

vi.mock("~/lib/conversations", () => ({
	createConversationId: vi.fn(() => "branch-1"),
}));

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
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

describe("useConversationActions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useChatStore.setState({
			currentConversationId: "conversation-1",
			isAuthenticated: true,
			isPro: true,
			localOnlyMode: false,
			chatMode: "remote",
			model: "test-model",
			chatSettings: {
				localOnly: false,
			} as any,
		});
	});

	it("persists an assistant branch without generating another response", async () => {
		const queryClient = createQueryClient();
		const conversation: Conversation = {
			id: "conversation-1",
			title: "Original conversation",
			isLocalOnly: false,
			messages: [
				{ id: "user-1", role: "user", content: "Question", model: "test-model" },
				{ id: "assistant-1", role: "assistant", content: "Answer", model: "test-model" },
				{ id: "user-2", role: "user", content: "Follow-up", model: "test-model" },
			],
		};
		queryClient.setQueryData([CHATS_QUERY_KEY, "conversation-1"], conversation);

		vi.mocked(apiService.updateConversation).mockResolvedValue({
			id: "branch-1",
			title: "Original conversation",
			messages: conversation.messages.slice(0, 2),
		});

		const generateResponse = vi.fn();
		const generateTitle = vi.fn();
		const { result } = renderHook(() => useConversationActions(generateResponse, generateTitle), {
			wrapper: wrapper(queryClient),
		});

		await act(async () => {
			await result.current.branchConversation("assistant-1");
		});

		expect(apiService.updateConversation).toHaveBeenCalledWith("branch-1", {
			title: "Original conversation",
			messages: conversation.messages.slice(0, 2),
			parent_conversation_id: "conversation-1",
			parent_message_id: "assistant-1",
		});
		expect(generateResponse).not.toHaveBeenCalled();
		expect(generateTitle).not.toHaveBeenCalled();
		expect(useChatStore.getState().currentConversationId).toBe("branch-1");
		expect(queryClient.getQueryData<Conversation>([CHATS_QUERY_KEY, "branch-1"])).toEqual(
			expect.objectContaining({
				id: "branch-1",
				messages: conversation.messages.slice(0, 2),
				parent_conversation_id: "conversation-1",
				parent_message_id: "assistant-1",
			}),
		);
	});
});
