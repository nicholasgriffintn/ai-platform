import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartesiaAudioProvider } from "../providers/CartesiaAudioProvider";
import { MelottsAudioProvider } from "../providers/MelottsAudioProvider";
import { MistralAudioProvider } from "../providers/MistralAudioProvider";

const mockGetResponse = vi.hoisted(() => vi.fn());
const mockCartesiaGetResponse = vi.hoisted(() => vi.fn());
const mockUploadObject = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());
const mockGatewayGetUrl = vi.hoisted(() => vi.fn());

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
	vi.stubGlobal("fetch", mockFetch);
	mockGatewayGetUrl.mockResolvedValue("https://gateway.example/mistral");
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

describe("MistralAudioProvider", () => {
	const env = {
		MISTRAL_API_KEY: "test-mistral-key",
		AI_GATEWAY_TOKEN: "test-gateway-token",
		AI: {
			gateway: () => ({
				getUrl: mockGatewayGetUrl,
			}),
		},
	} as any;

	it("returns inline audio data from a saved voice", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ audio_data: "YXVkaW8=" }), {
				headers: {
					"cf-aig-event-id": "event-1",
				},
			}),
		);

		const provider = new MistralAudioProvider();
		const result = await provider.synthesize({
			input: "Hello",
			env,
			user: { id: 1 } as any,
			voice: "82c99ee6-f932-423f-a4a3-d403c8914b8d",
			store: false,
		});

		const [, requestInit] = mockFetch.mock.calls[0];
		expect(mockFetch).toHaveBeenCalledWith(
			"https://gateway.example/mistral/v1/audio/speech",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: "Bearer test-mistral-key",
					"cf-aig-authorization": "test-gateway-token",
					"Content-Type": "application/json",
				}),
			}),
		);
		expect(JSON.parse(requestInit.body)).toEqual({
			model: "voxtral-mini-tts-2603",
			input: "Hello",
			response_format: "mp3",
			voice_id: "82c99ee6-f932-423f-a4a3-d403c8914b8d",
		});
		expect(result).toMatchObject({
			audioBase64: "YXVkaW8=",
			audioDataUrl: "data:audio/mpeg;base64,YXVkaW8=",
			audioMimeType: "audio/mpeg",
			metadata: {
				engine: "mistral",
				model: "voxtral-mini-tts-2603",
				responseFormat: "mp3",
				eventId: "event-1",
			},
		});
	});

	it("stores generated reference-audio speech in the requested format", async () => {
		mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ audio_data: "YXVkaW8=" })));

		const provider = new MistralAudioProvider();
		const result = await provider.synthesize({
			input: "Bonjour",
			env,
			user: { id: 1 } as any,
			refAudio: "cmVmLWF1ZGlv",
			responseFormat: "wav",
			slug: "tts/example",
			storage: {
				uploadObject: mockUploadObject,
			} as any,
		});

		const requestInit = mockFetch.mock.calls[0][1];
		expect(JSON.parse(requestInit.body)).toEqual({
			model: "voxtral-mini-tts-2603",
			input: "Bonjour",
			response_format: "wav",
			ref_audio: "cmVmLWF1ZGlv",
		});
		expect(mockUploadObject).toHaveBeenCalledWith("audio/tts/example.wav", expect.any(Uint8Array));
		expect(result).toMatchObject({
			key: "audio/tts/example.wav",
			audioMimeType: "audio/wav",
		});
	});
});
