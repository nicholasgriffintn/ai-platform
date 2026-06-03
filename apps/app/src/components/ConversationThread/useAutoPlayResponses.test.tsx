import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Message } from "~/types";
import { useAutoPlayResponses } from "./useAutoPlayResponses";

const mocks = vi.hoisted(() => ({
	determineStorageMode: vi.fn(),
	generateSpeech: vi.fn(),
	updateConversation: vi.fn(),
	updateRemoteConversation: vi.fn(),
}));

vi.mock("~/lib/api/api-service", () => ({
	apiService: {
		generateSpeech: mocks.generateSpeech,
		updateConversation: mocks.updateRemoteConversation,
	},
}));

vi.mock("~/hooks/useConversationStorage", () => ({
	useConversationStorage: () => ({
		determineStorageMode: mocks.determineStorageMode,
		updateConversation: mocks.updateConversation,
	}),
}));

function assistantMessage(id: string, content: string): Message {
	return {
		id,
		content,
		created: Date.now(),
		role: "assistant",
		timestamp: Date.now(),
	};
}

describe("useAutoPlayResponses", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
		window.HTMLMediaElement.prototype.pause = vi.fn();
		window.HTMLMediaElement.prototype.load = vi.fn();
		mocks.determineStorageMode.mockReturnValue({ shouldSyncRemote: true });
		mocks.updateConversation.mockImplementation(async (_conversationId, updater) => {
			updater({
				id: "conversation-1",
				title: "Conversation",
				messages: [assistantMessage("new-assistant-1", "Fresh response.")],
			});
		});
		mocks.generateSpeech.mockResolvedValue({
			status: "success",
			content: "Speech generated successfully",
			data: {
				audioKey: "tts/test.mp3",
				audioUrl: "https://assets.example/tts/test.mp3",
				audioMimeType: "audio/mpeg",
			},
		});
	});

	it("does not generate speech for a hydrated assistant message", async () => {
		renderHook(() =>
			useAutoPlayResponses({
				conversationId: "conversation-1",
				isEnabled: true,
				isStreaming: false,
				messages: [assistantMessage("stored-assistant-1", "Already saved response.")],
			}),
		);

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(mocks.generateSpeech).not.toHaveBeenCalled();
	});

	it("generates speech for the first assistant message after streaming completes", async () => {
		const initialMessages: Message[] = [];
		const { rerender } = renderHook(
			({ isStreaming, messages }: { isStreaming: boolean; messages: Message[] }) =>
				useAutoPlayResponses({
					conversationId: "conversation-1",
					isEnabled: true,
					isStreaming,
					messages,
				}),
			{
				initialProps: {
					isStreaming: true,
					messages: initialMessages,
				},
			},
		);

		await act(async () => {
			await Promise.resolve();
		});

		rerender({
			isStreaming: false,
			messages: [assistantMessage("new-assistant-1", "Fresh response.")],
		});

		await waitFor(() => {
			expect(mocks.generateSpeech).toHaveBeenCalledWith("Fresh response.");
		});
	});

	it("stores generated speech playback data against the assistant message", async () => {
		const initialMessages: Message[] = [];
		const { rerender } = renderHook(
			({ isStreaming, messages }: { isStreaming: boolean; messages: Message[] }) =>
				useAutoPlayResponses({
					conversationId: "conversation-1",
					isEnabled: true,
					isStreaming,
					messages,
				}),
			{
				initialProps: {
					isStreaming: true,
					messages: initialMessages,
				},
			},
		);

		await act(async () => {
			await Promise.resolve();
		});

		rerender({
			isStreaming: false,
			messages: [assistantMessage("new-assistant-1", "Fresh response.")],
		});

		await waitFor(() => {
			expect(mocks.generateSpeech).toHaveBeenCalledWith("Fresh response.");
		});

		await waitFor(() => {
			expect(mocks.updateConversation).toHaveBeenCalled();
		});

		await waitFor(() => {
			expect(mocks.updateRemoteConversation).toHaveBeenCalledWith("conversation-1", {
				messages: [
					expect.objectContaining({
						id: "new-assistant-1",
						data: {
							speech: expect.objectContaining({
								audioKey: "tts/test.mp3",
								audioUrl: "https://assets.example/tts/test.mp3",
							}),
						},
					}),
				],
			});
		});
	});
});
