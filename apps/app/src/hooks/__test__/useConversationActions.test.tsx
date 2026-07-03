import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHATS_QUERY_KEY } from "~/constants";
import { apiService } from "~/lib/api/api-service";
import { LoadingProvider, useIsLoading } from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";
import type { Conversation, Message } from "~/types";
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
		<QueryClientProvider client={queryClient}>
			<LoadingProvider>{children}</LoadingProvider>
		</QueryClientProvider>
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

	it("uses the stored branch response after branching compacted history", async () => {
		const queryClient = createQueryClient();
		const conversation: Conversation = {
			id: "conversation-1",
			title: "Compacted conversation",
			isLocalOnly: false,
			messages: [
				{ id: "old-user", role: "user", content: "Old visible turn", model: "test-model" },
				{
					id: "snapshot-1-compaction",
					role: "compaction",
					content: "Context compacted",
					parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
				},
				{
					id: "latest-user",
					role: "user",
					content: "What was this conversation about?",
					model: "test-model",
				},
			],
		};
		const storedBranchMessages: Message[] = [
			{
				id: "latest-user-copy",
				role: "user",
				content: "What was this conversation about?",
				model: "test-model",
			},
		];
		queryClient.setQueryData([CHATS_QUERY_KEY, "conversation-1"], conversation);
		vi.mocked(apiService.updateConversation).mockResolvedValue({
			id: "branch-1",
			title: "Compacted conversation",
			messages: storedBranchMessages,
			parent_conversation_id: "conversation-1",
			parent_message_id: "latest-user",
		});

		const generateResponse = vi.fn().mockResolvedValue({
			status: "success",
			response: "Branched response",
		});
		const generateTitle = vi.fn();
		const { result } = renderHook(() => useConversationActions(generateResponse, generateTitle), {
			wrapper: wrapper(queryClient),
		});

		await act(async () => {
			await result.current.branchConversation("latest-user");
		});

		expect(queryClient.getQueryData<Conversation>([CHATS_QUERY_KEY, "branch-1"])).toEqual(
			expect.objectContaining({
				messages: storedBranchMessages,
				parent_conversation_id: "conversation-1",
				parent_message_id: "latest-user",
			}),
		);
		expect(generateResponse).toHaveBeenCalledWith(
			storedBranchMessages,
			"branch-1",
			undefined,
			expect.objectContaining({
				generateTitle: false,
			}),
		);
		expect(generateResponse.mock.calls[0]?.[0]).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					content: "Old visible turn",
				}),
			]),
		);
	});

	it("appends a second opinion request and generates with the selected model", async () => {
		const queryClient = createQueryClient();
		const conversation: Conversation = {
			id: "conversation-1",
			title: "Original conversation",
			isLocalOnly: false,
			messages: [
				{ id: "user-1", role: "user", content: "Question", model: "test-model" },
				{ id: "assistant-1", role: "assistant", content: "Answer", model: "test-model" },
			],
		};
		queryClient.setQueryData([CHATS_QUERY_KEY, "conversation-1"], conversation);

		const generateResponse = vi.fn().mockResolvedValue({
			status: "success",
			response: "Second opinion",
		});
		const generateTitle = vi.fn();
		const { result } = renderHook(() => useConversationActions(generateResponse, generateTitle), {
			wrapper: wrapper(queryClient),
		});

		await act(async () => {
			await result.current.requestOpinion("assistant-1", {
				mode: "second-opinion",
				modelIds: ["opinion-model"],
			});
		});

		const updatedConversation = queryClient.getQueryData<Conversation>([
			CHATS_QUERY_KEY,
			"conversation-1",
		]);
		const opinionMessage = updatedConversation?.messages[2];

		expect(opinionMessage).toEqual(
			expect.objectContaining({
				role: "user",
				content: expect.stringContaining("Second opinion request"),
				data: {
					opinion: {
						mode: "second-opinion",
						sourceMessageId: "assistant-1",
						modelIds: ["opinion-model"],
					},
				},
			}),
		);
		expect(opinionMessage?.content).toContain("Source user message:");
		expect(opinionMessage?.content).toContain("Question");
		expect(opinionMessage?.content).toContain("Assistant answer to review:");
		expect(opinionMessage?.content).toContain("Answer");
		expect(apiService.updateConversation).not.toHaveBeenCalled();
		expect(generateResponse).toHaveBeenCalledWith(
			expect.arrayContaining([expect.objectContaining({ content: "Answer" }), opinionMessage]),
			"conversation-1",
			undefined,
			{
				generateTitle: false,
				model: "opinion-model",
				models: ["opinion-model"],
			},
		);
	});

	it("does not replace stored compacted history when requesting an opinion", async () => {
		const queryClient = createQueryClient();
		const conversation: Conversation = {
			id: "conversation-1",
			title: "Compacted conversation",
			isLocalOnly: false,
			messages: [
				{ id: "old-user", role: "user", content: "Old visible turn", model: "test-model" },
				{
					id: "snapshot-1-compaction",
					role: "compaction",
					content: "Context compacted",
					parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
				},
				{ id: "latest-user", role: "user", content: "Current question", model: "test-model" },
				{ id: "assistant-1", role: "assistant", content: "Current answer", model: "test-model" },
			],
		};
		queryClient.setQueryData([CHATS_QUERY_KEY, "conversation-1"], conversation);

		const generateResponse = vi.fn().mockResolvedValue({
			status: "success",
			response: "Second opinion",
		});
		const generateTitle = vi.fn();
		const { result } = renderHook(() => useConversationActions(generateResponse, generateTitle), {
			wrapper: wrapper(queryClient),
		});

		await act(async () => {
			await result.current.requestOpinion("assistant-1", {
				mode: "second-opinion",
				modelIds: ["opinion-model"],
			});
		});

		const updatedConversation = queryClient.getQueryData<Conversation>([
			CHATS_QUERY_KEY,
			"conversation-1",
		]);
		const opinionMessage = updatedConversation?.messages.at(-1);

		expect(apiService.updateConversation).not.toHaveBeenCalled();
		expect(opinionMessage).toEqual(
			expect.objectContaining({
				role: "user",
				content: expect.stringContaining("Current answer"),
			}),
		);
		expect(generateResponse).toHaveBeenCalledWith(
			expect.arrayContaining([opinionMessage]),
			"conversation-1",
			undefined,
			expect.objectContaining({
				generateTitle: false,
				model: "opinion-model",
			}),
		);
	});

	it("keeps the stream loading state active while requesting an opinion", async () => {
		const queryClient = createQueryClient();
		const conversation: Conversation = {
			id: "conversation-1",
			title: "Original conversation",
			isLocalOnly: false,
			messages: [
				{ id: "user-1", role: "user", content: "Question", model: "test-model" },
				{ id: "assistant-1", role: "assistant", content: "Answer", model: "test-model" },
			],
		};
		queryClient.setQueryData([CHATS_QUERY_KEY, "conversation-1"], conversation);

		let resolveResponse: (value: { status: "success"; response: string }) => void = () => {};
		const responsePromise = new Promise<{ status: "success"; response: string }>((resolve) => {
			resolveResponse = resolve;
		});
		const generateResponse = vi.fn().mockReturnValue(responsePromise);
		const generateTitle = vi.fn();
		const setStreamStarted = vi.fn();
		const { result } = renderHook(
			() => ({
				actions: useConversationActions(generateResponse, generateTitle, setStreamStarted),
				isStreaming: useIsLoading("stream-response"),
			}),
			{
				wrapper: wrapper(queryClient),
			},
		);

		let requestPromise: Promise<void> = Promise.resolve();
		act(() => {
			requestPromise = result.current.actions.requestOpinion("assistant-1", {
				mode: "second-opinion",
				modelIds: ["opinion-model"],
			});
		});

		await waitFor(() => expect(result.current.isStreaming).toBe(true));
		expect(setStreamStarted).toHaveBeenCalledWith(true);

		await act(async () => {
			resolveResponse({ status: "success", response: "Second opinion" });
			await requestPromise;
		});

		expect(result.current.isStreaming).toBe(false);
		expect(setStreamStarted).toHaveBeenLastCalledWith(false);
	});

	it("requires at least two models for consensus requests", async () => {
		const queryClient = createQueryClient();
		const conversation: Conversation = {
			id: "conversation-1",
			title: "Original conversation",
			isLocalOnly: false,
			messages: [
				{ id: "user-1", role: "user", content: "Question", model: "test-model" },
				{ id: "assistant-1", role: "assistant", content: "Answer", model: "test-model" },
			],
		};
		queryClient.setQueryData([CHATS_QUERY_KEY, "conversation-1"], conversation);

		const generateResponse = vi.fn();
		const generateTitle = vi.fn();
		const { result } = renderHook(() => useConversationActions(generateResponse, generateTitle), {
			wrapper: wrapper(queryClient),
		});

		await act(async () => {
			await result.current.requestOpinion("assistant-1", {
				mode: "consensus",
				modelIds: ["one-model"],
			});
		});

		expect(generateResponse).not.toHaveBeenCalled();
	});
});
