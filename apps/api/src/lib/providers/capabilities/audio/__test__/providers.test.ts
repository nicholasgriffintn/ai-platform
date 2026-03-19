import { describe, expect, it, vi } from "vitest";
import { MelottsAudioProvider } from "../providers/MelottsAudioProvider";

const mockGetResponse = vi.hoisted(() => vi.fn());

vi.mock("~/lib/providers/capabilities/chat/providers/workers", () => ({
	WorkersProvider: class MockWorkersProvider {
		getResponse = mockGetResponse;
	},
}));

describe("MelottsAudioProvider", () => {
	it("returns key/url when workers response contains attachments", async () => {
		mockGetResponse.mockResolvedValue({
			response: "Audio Generated.",
			data: {
				attachments: [
					{
						type: "audio",
						url: "https://assets.example/audio/file.mp3",
						key: "audio/file.mp3",
					},
				],
			},
		});

		const provider = new MelottsAudioProvider();
		const result = await provider.synthesize({
			input: "Hello",
			locale: "en",
			env: {} as any,
			user: {} as any,
		});

		expect(result).toMatchObject({
			key: "audio/file.mp3",
			url: "https://assets.example/audio/file.mp3",
			response: "Audio Generated.",
		});
	});
});
