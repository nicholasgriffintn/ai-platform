import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Message } from "~/types";
import { useAutoPlayResponses } from "./useAutoPlayResponses";

const mocks = vi.hoisted(() => ({
	generateSpeech: vi.fn(),
}));

vi.mock("~/lib/api/api-service", () => ({
	apiService: {
		generateSpeech: mocks.generateSpeech,
	},
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
		mocks.generateSpeech.mockResolvedValue({
			status: "success",
			content: "Speech generated successfully",
			data: {},
		});
	});

	it("does not generate speech for a hydrated assistant message", async () => {
		renderHook(() =>
			useAutoPlayResponses({
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

		rerender({
			isStreaming: false,
			messages: [assistantMessage("new-assistant-1", "Fresh response.")],
		});

		await waitFor(() => {
			expect(mocks.generateSpeech).toHaveBeenCalledWith("Fresh response.", { store: false });
		});
	});
});
