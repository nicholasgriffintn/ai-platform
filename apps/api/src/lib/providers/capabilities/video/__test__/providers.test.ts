import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReplicateVideoProvider } from "../providers/ReplicateVideoProvider";

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
		name: "Replicate Video",
		replicateInputSchema: {
			fields: [{ name: "prompt", type: "string", required: true }],
		},
	})),
}));

vi.mock("~/lib/providers/models/replicateValidation", () => ({
	validateReplicatePayload: vi.fn(),
}));

describe("video providers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("ReplicateVideoProvider maps prompt into replicate input", async () => {
		const provider = new ReplicateVideoProvider();
		mockChatProvider.getResponse.mockResolvedValue({
			data: { attachments: [{ url: "https://example.com/video.mp4" }] },
		});

		const result = await provider.generate({
			prompt: "A city skyline at night",
			env: {} as any,
			user: {} as any,
		});

		expect(mockChatProvider.getResponse).toHaveBeenCalledWith(
			expect.objectContaining({
				model: "replicate-model",
				body: {
					input: {
						prompt: "A city skyline at night",
					},
				},
			}),
		);
		expect(result.url).toBe("https://example.com/video.mp4");
	});
});
