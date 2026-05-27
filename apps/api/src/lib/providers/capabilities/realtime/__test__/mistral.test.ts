import { beforeEach, describe, expect, it, vi } from "vitest";

import { getModelConfigByModel } from "~/lib/providers/models";
import {
	getMistralTargetStreamingDelayMs,
	MistralRealtimeProvider,
} from "~/lib/providers/capabilities/realtime/providers";

vi.mock("~/lib/providers/models", () => ({
	getModelConfigByModel: vi.fn(),
}));

describe("MistralRealtimeProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getModelConfigByModel).mockResolvedValue({
			matchingModel: "voxtral-mini-transcribe-realtime-latest",
			name: "Voxtral Mini Transcribe Realtime",
			provider: "mistral",
			modalities: { input: ["audio"], output: ["text"] },
		});
	});

	it("creates a usable websocket transcription session with millisecond delay", async () => {
		const provider = new MistralRealtimeProvider();
		const session = await provider.createSession({
			env: { API_BASE_URL: "https://api.polychat.test" } as any,
			user: { id: 1 } as any,
			type: "transcription",
			delay: "minimal",
		});

		expect(session).toMatchObject({
			provider: "mistral",
			transport: "websocket",
			input_audio_format: "pcm_s16le",
			target_streaming_delay_ms: 240,
			url: "wss://api.polychat.test/realtime/mistral/transcription?model=voxtral-mini-transcribe-realtime-latest&delay=minimal",
		});
	});

	it("maps named delays to Mistral target streaming delay milliseconds", () => {
		expect(getMistralTargetStreamingDelayMs("low")).toBe(500);
		expect(getMistralTargetStreamingDelayMs("xhigh")).toBe(5000);
	});
});
