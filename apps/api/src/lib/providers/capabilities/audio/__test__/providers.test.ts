import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartesiaAudioProvider } from "../providers/CartesiaAudioProvider";
import { MelottsAudioProvider } from "../providers/MelottsAudioProvider";

const mockGetResponse = vi.hoisted(() => vi.fn());
const mockCartesiaGetResponse = vi.hoisted(() => vi.fn());
const mockUploadObject = vi.hoisted(() => vi.fn());

vi.mock("~/lib/providers/capabilities/chat/providers/workers", () => ({
	WorkersProvider: class MockWorkersProvider {
		getResponse = mockGetResponse;
	},
}));

vi.mock("~/lib/providers/capabilities/chat/providers/certesia", () => ({
	CertesiaProvider: class MockCertesiaProvider {
		getResponse = mockCartesiaGetResponse;
	},
}));

beforeEach(() => {
	vi.clearAllMocks();
});

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

describe("CartesiaAudioProvider", () => {
	it("returns inline audio data when storage is disabled", async () => {
		mockCartesiaGetResponse.mockResolvedValue(new ArrayBuffer(4));

		const provider = new CartesiaAudioProvider();
		const result = await provider.synthesize({
			input: "Hello",
			env: {} as any,
			user: {} as any,
			store: false,
			storage: {
				uploadObject: mockUploadObject,
			} as any,
		});

		expect(mockUploadObject).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			audioBase64: "AAAAAA==",
			audioDataUrl: "data:audio/mpeg;base64,AAAAAA==",
			audioMimeType: "audio/mpeg",
		});
	});
});
