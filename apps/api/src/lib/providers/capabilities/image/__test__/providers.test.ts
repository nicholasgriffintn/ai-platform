import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReplicateImageProvider } from "../providers/ReplicateImageProvider";
import { WorkersAiImageProvider } from "../providers/WorkersAiImageProvider";

const mockChatProvider = {
	getResponse: vi.fn(),
};

vi.mock("~/lib/providers/capabilities/chat", () => ({
	getChatProvider: vi.fn(() => mockChatProvider),
}));

vi.mock("~/lib/prompts/image", () => ({
	getTextToImageSystemPrompt: vi.fn(() => "STYLE"),
	imagePrompts: {
		default: "default style",
	},
}));

vi.mock("~/lib/providers/models", () => ({
	getModelConfigByModel: vi.fn(async () => ({
		matchingModel: "replicate-model",
		provider: "replicate",
		name: "Replicate Image",
		replicateInputSchema: {
			fields: [{ name: "prompt", type: "string", required: true }],
		},
	})),
}));

vi.mock("~/lib/providers/models/replicateValidation", () => ({
	validateReplicatePayload: vi.fn(),
}));

describe("image providers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("WorkersAiImageProvider uses a styled prompt", async () => {
		const provider = new WorkersAiImageProvider();
		mockChatProvider.getResponse.mockResolvedValue({
			data: { attachments: [{ url: "https://example.com/image.png" }] },
		});

		const result = await provider.generate({
			prompt: "A skyline at dusk",
			env: {} as any,
			user: {} as any,
			style: "default",
		});

		expect(mockChatProvider.getResponse).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: [
					{
						role: "user",
						content: [
							{
								type: "text",
								text: "STYLE\n\nA skyline at dusk",
							},
						],
					},
				],
			}),
		);
		expect(result.url).toBe("https://example.com/image.png");
	});

	it("ReplicateImageProvider maps request into replicate input", async () => {
		const provider = new ReplicateImageProvider();
		mockChatProvider.getResponse.mockResolvedValue({
			data: { attachments: [{ url: "https://example.com/image.png" }] },
		});

		const result = await provider.generate({
			prompt: "A forest trail",
			env: {} as any,
			user: {} as any,
			style: "default",
			aspectRatio: "16:9",
		});

		expect(mockChatProvider.getResponse).toHaveBeenCalledWith(
			expect.objectContaining({
				model: "replicate-model",
				body: {
					input: {
						prompt: "STYLE\n\nA forest trail",
						aspect_ratio: "16:9",
					},
				},
			}),
		);
		expect(result.url).toBe("https://example.com/image.png");
	});
});
