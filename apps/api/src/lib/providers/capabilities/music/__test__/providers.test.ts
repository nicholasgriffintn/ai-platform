import { beforeEach, describe, expect, it, vi } from "vitest";

import { ElevenLabsMusicProvider } from "../providers/ElevenLabsMusicProvider";
import { ReplicateMusicProvider } from "../providers/ReplicateMusicProvider";

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
		name: "Replicate Music",
		replicateInputSchema: {
			fields: [{ name: "prompt", type: "string", required: true }],
		},
	})),
}));

vi.mock("~/lib/providers/models/replicateValidation", () => ({
	validateReplicatePayload: vi.fn(),
}));

describe("music providers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("ReplicateMusicProvider maps prompt into replicate input", async () => {
		const provider = new ReplicateMusicProvider();
		mockChatProvider.getResponse.mockResolvedValue({
			data: { attachments: [{ url: "https://example.com/audio.mp3" }] },
		});

		const result = await provider.generate({
			prompt: "Upbeat synthwave",
			env: {} as any,
			user: {} as any,
		});

		expect(mockChatProvider.getResponse).toHaveBeenCalledWith(
			expect.objectContaining({
				model: "replicate-model",
				body: {
					input: {
						prompt: "Upbeat synthwave",
					},
				},
			}),
		);
		expect(result.url).toBe("https://example.com/audio.mp3");
	});

	it("ElevenLabsMusicProvider overrides the default model", async () => {
		const provider = new ElevenLabsMusicProvider();
		mockChatProvider.getResponse.mockResolvedValue({
			data: { attachments: [{ url: "https://example.com/audio.mp3" }] },
		});

		await provider.generate({
			prompt: "Ambient pads",
			env: {} as any,
			user: {} as any,
		});

		const { getModelConfigByModel } = await import("~/lib/providers/models");
		expect(vi.mocked(getModelConfigByModel)).toHaveBeenCalledWith(
			"replicate-elevenlabs-music",
		);
	});
});
