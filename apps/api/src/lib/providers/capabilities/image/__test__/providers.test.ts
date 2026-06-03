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
	findModelConfig: vi.fn(async () => ({
		matchingModel: "replicate-model",
		provider: "replicate",
		name: "Replicate Image",
		modalities: {
			input: ["text"],
			output: ["image"],
		},
		inputSchema: {
			fields: [{ name: "prompt", type: "string", required: true }],
		},
	})),
}));

vi.mock("~/lib/providers/models/replicateValidation", () => ({
	validateReplicatePayload: vi.fn(),
}));

describe("image providers", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		const { findModelConfig } = await import("~/lib/providers/models");
		vi.mocked(findModelConfig).mockResolvedValue({
			matchingModel: "replicate-model",
			provider: "replicate",
			name: "Replicate Image",
			modalities: {
				input: ["text"],
				output: ["image"],
			},
			inputSchema: {
				fields: [{ name: "prompt", type: "string", required: true }],
			},
		});
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

	it("WorkersAiImageProvider resolves full Workers AI model ids", async () => {
		const provider = new WorkersAiImageProvider();
		const env = Object.create(null);
		const user = Object.create(null);
		const { findModelConfig } = await import("~/lib/providers/models");
		vi.mocked(findModelConfig).mockResolvedValue({
			matchingModel: "@cf/black-forest-labs/flux-2-dev",
			provider: "workers-ai",
			name: "Black Forest Labs Flux 2 Dev",
			modalities: {
				input: ["text"],
				output: ["image"],
			},
		});
		mockChatProvider.getResponse.mockResolvedValue({
			data: { attachments: [{ url: "https://example.com/image.png" }] },
		});

		await provider.generate({
			prompt: "A neon portrait",
			env,
			user,
			style: "default",
			model: "@cf/black-forest-labs/flux-2-dev",
		});

		expect(findModelConfig).toHaveBeenCalledWith(
			"@cf/black-forest-labs/flux-2-dev",
			env,
			"workers-ai",
		);
		expect(mockChatProvider.getResponse).toHaveBeenCalledWith(
			expect.objectContaining({
				model: "@cf/black-forest-labs/flux-2-dev",
			}),
		);
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
