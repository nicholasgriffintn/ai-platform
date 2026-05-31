import { beforeEach, describe, expect, it, vi } from "vitest";

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
		inputSchema: {
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
});
