import { describe, expect, it } from "vitest";

import { REALTIME_LIVE_PROVIDER_MANIFEST } from "@assistant/schemas";
import {
	getComposedRealtimeReasoningModelId,
	getDefaultLiveModelId,
	getRealtimeLiveProviderOption,
	getRealtimeLiveProviderIdForModel,
	isRealtimeLiveProviderId,
	supportsRealtimeLiveVideoInput,
	waitsForRealtimeLiveProviderFinalEventOnStop,
} from "./live-providers";

describe("live realtime providers", () => {
	it("recognises configured live provider ids", () => {
		expect(isRealtimeLiveProviderId("openai")).toBe(true);
		expect(isRealtimeLiveProviderId("google-ai-studio")).toBe(true);
		expect(isRealtimeLiveProviderId("mistral")).toBe(true);
		expect(isRealtimeLiveProviderId("elevenlabs")).toBe(true);
		expect(isRealtimeLiveProviderId("cartesia")).toBe(true);
		expect(isRealtimeLiveProviderId("anthropic")).toBe(false);
	});

	it("derives the live provider from a realtime model", () => {
		expect(
			getRealtimeLiveProviderIdForModel({
				provider: "mistral",
				supportsRealtimeSession: true,
			}),
		).toBe("mistral");

		expect(
			getRealtimeLiveProviderIdForModel({
				provider: "mistral",
				supportsRealtimeSession: false,
			}),
		).toBeUndefined();
	});

	it("uses the shared provider manifest for default models and video support", () => {
		for (const provider of REALTIME_LIVE_PROVIDER_MANIFEST) {
			expect(getDefaultLiveModelId(provider.id)).toBe(provider.defaultModelId);
		}

		expect(supportsRealtimeLiveVideoInput("google-ai-studio")).toBe(true);
		expect(supportsRealtimeLiveVideoInput("mistral")).toBe(false);
	});

	it("marks native and composed live provider modes explicitly", () => {
		expect(getRealtimeLiveProviderOption("openai").liveMode).toBe("native");
		expect(getRealtimeLiveProviderOption("google-ai-studio").liveMode).toBe("native");
		expect(getRealtimeLiveProviderOption("mistral").liveMode).toBe("composed");
		expect(getRealtimeLiveProviderOption("elevenlabs").liveMode).toBe("composed");
		expect(getRealtimeLiveProviderOption("cartesia").liveMode).toBe("composed");
	});

	it("resolves a chat model for composed realtime reasoning", () => {
		expect(
			getComposedRealtimeReasoningModelId(
				{
					"voxtral-mini-transcribe-realtime": {
						id: "voxtral-mini-transcribe-realtime",
						matchingModel: "voxtral-mini-transcribe-realtime-2602",
						name: "Voxtral Mini Transcribe Realtime",
						provider: "mistral",
						modalities: { input: ["audio"], output: ["transcription"] },
						supportsRealtimeSession: true,
					},
					"deepseek-chat": {
						id: "deepseek-chat",
						matchingModel: "deepseek-chat",
						name: "DeepSeek Chat",
						provider: "deepseek",
						modalities: { input: ["text"], output: ["text"] },
					},
				},
				"voxtral-mini-transcribe-realtime",
			),
		).toBe("deepseek-chat");
	});

	it("prefers the default chat model over object order for composed realtime reasoning", () => {
		expect(
			getComposedRealtimeReasoningModelId(
				{
					o1: {
						id: "o1",
						matchingModel: "o1",
						name: "o1",
						provider: "openai",
						modalities: { input: ["text"], output: ["text"] },
					},
					"deepseek-chat": {
						id: "deepseek-chat",
						matchingModel: "deepseek-chat",
						name: "DeepSeek Chat",
						provider: "deepseek",
						modalities: { input: ["text"], output: ["text"] },
					},
				},
				"voxtral-mini-transcribe-realtime",
			),
		).toBe("deepseek-chat");
	});

	it("waits for transcription done events before closing providers that finalise on stop", () => {
		expect(
			getRealtimeLiveProviderOption("mistral").websocket?.audioInput?.waitForFinalEventTypeOnStop,
		).toBe("transcription.done");
		expect(
			getRealtimeLiveProviderOption("elevenlabs").websocket?.audioInput
				?.waitForFinalEventTypeOnStop,
		).toBe("transcription.done");
		expect(
			getRealtimeLiveProviderOption("cartesia").websocket?.audioInput?.waitForFinalEventTypeOnStop,
		).toBe("transcription.done");
		expect(waitsForRealtimeLiveProviderFinalEventOnStop("mistral")).toBe(true);
		expect(waitsForRealtimeLiveProviderFinalEventOnStop("openai")).toBe(false);
	});

	it("configures Mistral turn commits separately from session end", () => {
		const audioInput = getRealtimeLiveProviderOption("mistral").websocket?.audioInput;

		expect(audioInput?.commitMessages).toEqual([{ type: "input_audio.flush" }]);
		expect(audioInput?.commitOnSilence).toEqual({
			continueLevelThreshold: 0.045,
			minSpeechMs: 220,
			silenceMs: 420,
			startLevelThreshold: 0.075,
		});
		expect(audioInput?.endMessages).toEqual([
			{ type: "input_audio.flush" },
			{ type: "input_audio.end" },
		]);
	});
});
