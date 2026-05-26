import { describe, expect, it } from "vitest";

import { googleAiStudioModelConfig } from "../google-ai-studio";

describe("googleAiStudioModelConfig", () => {
	it("registers Gemini Live and TTS models with audio capabilities", () => {
		expect(googleAiStudioModelConfig["gemini-3.1-flash-live-preview"]).toMatchObject({
			matchingModel: "gemini-3.1-flash-live-preview",
			supportsRealtimeSession: true,
			supportsAudio: true,
			modalities: {
				input: ["text", "image", "audio", "video"],
				output: ["text", "audio"],
			},
		});
		expect(googleAiStudioModelConfig["gemini-3.1-flash-tts-preview"]).toMatchObject({
			matchingModel: "gemini-3.1-flash-tts-preview",
			supportsAudio: true,
			modalities: {
				input: ["text"],
				output: ["audio"],
			},
		});
		expect(googleAiStudioModelConfig["gemini-2.5-flash-preview-tts"]?.supportsAudio).toBe(true);
		expect(googleAiStudioModelConfig["gemini-2.5-pro-preview-tts"]?.supportsAudio).toBe(true);
	});

	it("marks current Gemini URL context models", () => {
		expect(googleAiStudioModelConfig["gemini-3.5-flash"]?.supportsUrlContext).toBe(true);
		expect(googleAiStudioModelConfig["gemini-3.1-pro-preview"]?.supportsUrlContext).toBe(true);
		expect(googleAiStudioModelConfig["gemini-2.5-flash"]?.supportsUrlContext).toBe(true);
	});
});
