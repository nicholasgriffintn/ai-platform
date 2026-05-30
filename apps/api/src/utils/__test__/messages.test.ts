import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Message } from "~/types";
import { formatMessages, formatTextGenerationPrompt } from "../messages";

vi.mock("~/lib/formatter", () => ({
	MessageFormatter: {
		formatMessages: vi.fn(),
		formatTextGenerationPrompt: vi.fn(),
	},
}));

describe("messages", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("formatMessages", () => {
		it("should call MessageFormatter.formatMessages with correct parameters", async () => {
			const mockMessageHistory: Message[] = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there!" },
			];
			const provider = "openai";
			const systemPrompt = "You are a helpful assistant";
			const model = "gpt-4";

			const { MessageFormatter } = vi.mocked(await import("~/lib/formatter"));
			const mockFormattedMessages: Message[] = [
				{ role: "system", content: systemPrompt },
				...mockMessageHistory,
			];
			// @ts-expect-error - mockReturnValue is not a function
			MessageFormatter.formatMessages.mockReturnValue(mockFormattedMessages);

			const result = formatMessages(provider, mockMessageHistory, systemPrompt, model);

			expect(MessageFormatter.formatMessages).toHaveBeenCalledWith(mockMessageHistory, {
				provider,
				model,
				system_prompt: systemPrompt,
				maxTokens: 0,
				truncationStrategy: "tail",
			});
			expect(result).toEqual(mockFormattedMessages);
		});

		it("should work without optional parameters", async () => {
			const mockMessageHistory: Message[] = [{ role: "user", content: "Hello" }];
			const provider = "anthropic";

			const { MessageFormatter } = vi.mocked(await import("~/lib/formatter"));
			// @ts-expect-error - mockReturnValue is not a function
			MessageFormatter.formatMessages.mockReturnValue(mockMessageHistory);

			const result = formatMessages(provider, mockMessageHistory);

			expect(MessageFormatter.formatMessages).toHaveBeenCalledWith(mockMessageHistory, {
				provider,
				model: undefined,
				system_prompt: undefined,
				maxTokens: 0,
				truncationStrategy: "tail",
			});
			expect(result).toEqual(mockMessageHistory);
		});

		it("should handle empty message history", async () => {
			const provider = "openai";
			const emptyHistory: Message[] = [];

			const { MessageFormatter } = vi.mocked(await import("~/lib/formatter"));
			// @ts-expect-error - mockReturnValue is not a function
			MessageFormatter.formatMessages.mockReturnValue(emptyHistory);

			const result = formatMessages(provider, emptyHistory);

			expect(MessageFormatter.formatMessages).toHaveBeenCalledWith(emptyHistory, {
				provider,
				model: undefined,
				system_prompt: undefined,
				maxTokens: 0,
				truncationStrategy: "tail",
			});
			expect(result).toEqual(emptyHistory);
		});
	});

	describe("formatTextGenerationPrompt", () => {
		it("should call MessageFormatter.formatTextGenerationPrompt with common formatting options", async () => {
			const mockMessageHistory: Message[] = [{ role: "user", content: "Hello" }];
			const provider = "sagemaker";
			const systemPrompt = "Stay concise";
			const model = "endpoint";

			const { MessageFormatter } = vi.mocked(await import("~/lib/formatter"));
			// @ts-expect-error - mockReturnValue is not a function
			MessageFormatter.formatTextGenerationPrompt.mockReturnValue(
				"System: Stay concise\nUser: Hello\nAssistant:",
			);

			const result = formatTextGenerationPrompt(provider, mockMessageHistory, systemPrompt, model);

			expect(MessageFormatter.formatTextGenerationPrompt).toHaveBeenCalledWith(mockMessageHistory, {
				provider,
				model,
				system_prompt: systemPrompt,
				maxTokens: 0,
				truncationStrategy: "tail",
			});
			expect(result).toBe("System: Stay concise\nUser: Hello\nAssistant:");
		});
	});
});
