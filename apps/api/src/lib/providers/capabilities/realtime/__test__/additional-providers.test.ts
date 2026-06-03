import { beforeEach, describe, expect, it, vi } from "vitest";

import { getModelConfigByModel } from "~/lib/providers/models";
import {
	CartesiaRealtimeProvider,
	ElevenLabsRealtimeProvider,
} from "~/lib/providers/capabilities/realtime/providers";

vi.mock("~/lib/providers/models", () => ({
	getModelConfigByModel: vi.fn(),
}));

describe("additional realtime providers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getModelConfigByModel).mockImplementation(async (model: string) => {
			const providerByModel: Record<string, string> = {
				scribe_v2_realtime: "elevenlabs",
				"ink-whisper": "cartesia",
			};

			return {
				matchingModel: model,
				name: model,
				provider: providerByModel[model],
				modalities: { input: ["audio"], output: ["text"] },
			} as any;
		});
	});

	it("creates an ElevenLabs Scribe websocket transcription session", async () => {
		const provider = new ElevenLabsRealtimeProvider();
		const session = await provider.createSession({
			env: { API_BASE_URL: "https://api.polychat.test" } as any,
			user: { id: 1 } as any,
			type: "transcription",
			delay: "minimal",
		});

		expect(session).toMatchObject({
			provider: "elevenlabs",
			transport: "websocket",
			input_audio_format: "pcm_s16le",
			url: "wss://api.polychat.test/realtime/elevenlabs/transcription?model=scribe_v2_realtime&delay=minimal",
		});
	});

	it("creates a Cartesia Ink websocket transcription session", async () => {
		const provider = new CartesiaRealtimeProvider();
		const session = await provider.createSession({
			env: { API_BASE_URL: "https://api.polychat.test" } as any,
			user: { id: 1 } as any,
			type: "transcription",
			delay: "low",
		});

		expect(session).toMatchObject({
			provider: "cartesia",
			transport: "websocket",
			input_audio_format: "pcm_s16le",
			url: "wss://api.polychat.test/realtime/cartesia/transcription?model=ink-whisper&delay=low",
		});
	});
});
