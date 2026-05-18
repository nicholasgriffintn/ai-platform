import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { CHATS_QUERY_KEY } from "~/constants";
import { useChatStore } from "~/state/stores/chatStore";
import type { Conversation } from "~/types";
import { useMessageOperations } from "../useMessageOperations";

function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});
}

function conversation(messages: Conversation["messages"]): Conversation {
	return {
		id: "conversation-1",
		title: "Test",
		isLocalOnly: false,
		messages,
	};
}

describe("useMessageOperations", () => {
	beforeEach(() => {
		useChatStore.setState({
			isAuthenticated: true,
			isPro: true,
			localOnlyMode: false,
			chatMode: "remote",
			model: "test-model",
		});
	});

	it("throws by default when there is no assistant message to update", async () => {
		const queryClient = createQueryClient();
		queryClient.setQueryData(
			[CHATS_QUERY_KEY, "conversation-1"],
			conversation([{ id: "user-1", role: "user", content: "Question", model: "test-model" }]),
		);
		const wrapper = ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
		const { result } = renderHook(() => useMessageOperations(), { wrapper });

		await expect(
			act(async () => {
				await result.current.updateAssistantMessage("conversation-1", "Answer");
			}),
		).rejects.toThrow("No assistant message found to update");
	});

	it("adds an assistant placeholder and returns its message", async () => {
		const queryClient = createQueryClient();
		queryClient.setQueryData(
			[CHATS_QUERY_KEY, "conversation-1"],
			conversation([{ id: "user-1", role: "user", content: "Question", model: "test-model" }]),
		);
		const wrapper = ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
		const { result } = renderHook(() => useMessageOperations(), { wrapper });

		let assistantId: string | undefined;
		await act(async () => {
			const assistantMessage = await result.current.addAssistantMessage("conversation-1", "");
			assistantId = assistantMessage.id;
		});

		const updated = queryClient.getQueryData<Conversation>([CHATS_QUERY_KEY, "conversation-1"]);
		expect(updated?.messages).toEqual([
			expect.objectContaining({ id: "user-1", role: "user", content: "Question" }),
			expect.objectContaining({ id: assistantId, role: "assistant", content: "" }),
		]);
	});

	it("updates a specific assistant message by id", async () => {
		const queryClient = createQueryClient();
		queryClient.setQueryData(
			[CHATS_QUERY_KEY, "conversation-1"],
			conversation([
				{ id: "user-1", role: "user", content: "Question", model: "test-model" },
				{ id: "assistant-1", role: "assistant", content: "First", model: "test-model" },
				{ id: "assistant-2", role: "assistant", content: "Second", model: "test-model" },
			]),
		);
		const wrapper = ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
		const { result } = renderHook(() => useMessageOperations(), { wrapper });

		await act(async () => {
			await result.current.updateAssistantMessage(
				"conversation-1",
				"Answer",
				undefined,
				{ id: "assistant-1" },
				{
					messageId: "assistant-1",
				},
			);
		});

		const updated = queryClient.getQueryData<Conversation>([CHATS_QUERY_KEY, "conversation-1"]);
		expect(updated?.messages).toEqual([
			expect.objectContaining({ id: "user-1", role: "user", content: "Question" }),
			expect.objectContaining({ id: "assistant-1", role: "assistant", content: "Answer" }),
			expect.objectContaining({ id: "assistant-2", role: "assistant", content: "Second" }),
		]);
	});

	it("updates the latest assistant message when a placeholder exists", async () => {
		const queryClient = createQueryClient();
		queryClient.setQueryData(
			[CHATS_QUERY_KEY, "conversation-1"],
			conversation([
				{ id: "user-1", role: "user", content: "Question", model: "test-model" },
				{ id: "assistant-1", role: "assistant", content: "", model: "test-model" },
			]),
		);
		const wrapper = ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
		const { result } = renderHook(() => useMessageOperations(), { wrapper });

		await act(async () => {
			await result.current.updateAssistantMessage("conversation-1", "Answer", undefined, {
				id: "assistant-1",
			});
		});

		const updated = queryClient.getQueryData<Conversation>([CHATS_QUERY_KEY, "conversation-1"]);
		expect(updated?.messages).toHaveLength(2);
		expect(updated?.messages[1]).toEqual(
			expect.objectContaining({ id: "assistant-1", role: "assistant", content: "Answer" }),
		);
	});
});
