import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CreateChatCompletionsResponse, Message } from "~/types";
import {
	buildInboundMessageContent,
	extractChatCompletionNotification,
	extractChatCompletionText,
	formatMessages,
	formatTextGenerationPrompt,
} from "../messages";

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

	describe("chat completion extraction", () => {
		function createCompletion(
			message: CreateChatCompletionsResponse["choices"][number]["message"],
		): CreateChatCompletionsResponse {
			return {
				id: "completion-1",
				log_id: "log-1",
				object: "chat.completion",
				created: 1,
				choices: [
					{
						index: 0,
						message,
						finish_reason: "stop",
					},
				],
				usage: {
					prompt_tokens: 1,
					completion_tokens: 1,
					total_tokens: 2,
				},
			};
		}

		it("extracts text from multipart assistant content", () => {
			const response = createCompletion({
				role: "assistant",
				content: [
					{ type: "text", text: "Generated assets" },
					{
						type: "image_url",
						image_url: { url: "https://api.polychat.test/assets/image-1" },
					},
				],
			});

			expect(extractChatCompletionText(response)).toBe("Generated assets");
		});

		it("extracts notification media from content parts and generated asset metadata", () => {
			const response = createCompletion({
				role: "assistant",
				content: [
					{ type: "text", text: "Generated assets" },
					{
						type: "image_url",
						image_url: { url: "https://api.polychat.test/assets/image-1" },
					},
					{
						type: "audio_url",
						audio_url: { url: "https://api.polychat.test/assets/audio-1" },
					},
				],
				data: {
					imageUrl: "https://api.polychat.test/assets/image-2",
					assets: [
						{ url: "https://api.polychat.test/assets/image-1" },
						{ url: "http://api.polychat.test/assets/not-deliverable" },
						{ url: "data:image/png;base64,not-deliverable" },
						{ url: "s3://polychat-mms/generated/image-3.png" },
					],
				},
			});

			expect(extractChatCompletionNotification(response)).toEqual({
				body: "Generated assets",
				mediaUrls: [
					"https://api.polychat.test/assets/image-1",
					"https://api.polychat.test/assets/audio-1",
					"https://api.polychat.test/assets/image-2",
					"s3://polychat-mms/generated/image-3.png",
				],
			});
		});

		it("extracts notification media from tool result choices", () => {
			const qrImageUrl = "http://pashi.app/api/qr?data=polychat&format=png&size=520x520";
			const response = createCompletion({
				role: "assistant",
				content: "QR code ready.",
			});
			response.choices.push({
				index: 1,
				message: {
					role: "tool",
					content: "QR code image created.",
					data: {
						imageUrl: qrImageUrl,
					},
				},
				finish_reason: "tool_result",
			});

			expect(extractChatCompletionNotification(response)).toEqual({
				body: "QR code ready.",
				mediaUrls: [qrImageUrl],
			});
		});

		it("extracts notification media from nested recipe tool notifications", () => {
			const response = createCompletion({
				role: "assistant",
				content: "Recipe complete.",
			});
			response.choices.push({
				index: 1,
				message: {
					role: "tool",
					content: "Nutrition summary attached.",
					data: {
						mediaUrls: ["https://api.polychat.test/assets/nutrition-image"],
						notification: {
							body: "Nutrition summary attached.",
							mediaUrls: [
								"https://api.polychat.test/assets/nutrition-image",
								"s3://polychat-mms/generated/nutrition-image.png",
							],
						},
					},
				},
				finish_reason: "tool_result",
			});

			expect(extractChatCompletionNotification(response)).toEqual({
				body: "Recipe complete.",
				mediaUrls: [
					"https://api.polychat.test/assets/nutrition-image",
					"s3://polychat-mms/generated/nutrition-image.png",
				],
			});
		});
	});

	describe("inbound message content", () => {
		it("builds multimodal message content for inbound HTTPS images", () => {
			expect(
				buildInboundMessageContent({
					body: "what is this?",
					media: [
						{
							url: "https://media.twilio.com/image",
							mimeType: "image/jpeg",
						},
					],
				}),
			).toEqual([
				{ type: "text", text: "what is this?" },
				{
					type: "image_url",
					image_url: { url: "https://media.twilio.com/image" },
				},
			]);
		});

		it("filters unsafe inbound media URLs and describes unsupported HTTPS media", () => {
			expect(
				buildInboundMessageContent({
					body: "",
					media: [
						{ url: "http://media.example.test/image.jpg", mimeType: "image/jpeg" },
						{ url: "https://user:pass@media.example.test/image.jpg", mimeType: "image/jpeg" },
						{ url: "https://media.example.test/audio.mp3", mimeType: "audio/mpeg" },
					],
				}),
			).toEqual([
				{
					type: "text",
					text: "Attached media URLs: https://media.example.test/audio.mp3",
				},
			]);
		});
	});
});
