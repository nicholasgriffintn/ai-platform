import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReplicateSpeechProvider } from "../providers/ReplicateSpeechProvider";
import { WorkersAiSpeechProvider } from "../providers/WorkersAiSpeechProvider";

const mockChatProvider = {
	getResponse: vi.fn(),
};

vi.mock("~/lib/providers/capabilities/chat", () => ({
	getChatProvider: vi.fn(() => mockChatProvider),
}));

vi.mock("~/lib/providers/models", () => ({
	getModelConfigByModel: vi.fn(async () => ({
		matchingModel: "replicate-model",
		provider: "replicate",
		name: "Replicate Speech",
		inputSchema: {
			fields: [{ name: "text", type: "string", required: true }],
		},
	})),
}));

vi.mock("~/lib/providers/models/replicateValidation", () => ({
	validateReplicatePayload: vi.fn(),
}));

describe("speech providers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("WorkersAiSpeechProvider sends text content", async () => {
		const provider = new WorkersAiSpeechProvider();
		mockChatProvider.getResponse.mockResolvedValue({
			data: { attachments: [{ url: "https://example.com/audio.mp3" }] },
		});

		const result = await provider.generate({
			prompt: "Hello world",
			env: {} as any,
			user: {} as any,
		});

		expect(mockChatProvider.getResponse).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: [
					{
						role: "user",
						content: [
							{
								type: "text",
								text: "Hello world",
							},
						],
					},
				],
			}),
		);
		expect(result.url).toBe("https://example.com/audio.mp3");
	});

	it("ReplicateSpeechProvider maps prompt into replicate input", async () => {
		const provider = new ReplicateSpeechProvider();
		mockChatProvider.getResponse.mockResolvedValue({
			data: { attachments: [{ url: "https://example.com/audio.mp3" }] },
		});

		const result = await provider.generate({
			prompt: "Testing speech",
			env: {} as any,
			user: {} as any,
		});

		expect(mockChatProvider.getResponse).toHaveBeenCalledWith(
			expect.objectContaining({
				model: "replicate-model",
				body: {
					input: {
						text: "Testing speech",
						prompt: "Testing speech",
					},
				},
			}),
		);
		expect(result.url).toBe("https://example.com/audio.mp3");
	});
});
