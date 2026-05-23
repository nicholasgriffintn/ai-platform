import { describe, expect, it } from "vitest";

import { openaiModelConfig } from "../openai";

describe("openaiModelConfig", () => {
	it("only enables OpenAI tool search on supported GPT-5.4+ models", () => {
		expect(openaiModelConfig["gpt-5.3-codex"]?.supportsToolSearch).toBeUndefined();
		expect(openaiModelConfig["gpt-5.4"]?.supportsToolSearch).toBe(true);
		expect(openaiModelConfig["gpt-5.4-mini"]?.supportsToolSearch).toBe(true);
		expect(openaiModelConfig["gpt-5.4-nano"]?.supportsToolSearch).toBe(true);
		expect(openaiModelConfig["gpt-5.4-pro"]?.supportsToolSearch).toBe(true);
		expect(openaiModelConfig["gpt-5.5"]?.supportsToolSearch).toBe(true);
		expect(openaiModelConfig["gpt-5.5-pro"]?.supportsToolSearch).toBe(true);
	});

	it("only exposes tools the app can execute without a custom action loop", () => {
		expect(openaiModelConfig["gpt-5.4-pro"]?.supportsCodeExecution).toBe(false);
		expect(openaiModelConfig["gpt-5.4-pro"]?.supportsHostedShell).toBeUndefined();
		expect(openaiModelConfig["gpt-5.4-pro"]?.supportsToolSearch).toBe(true);
	});

	it("registers current OpenAI realtime and audio models with usable capabilities", () => {
		expect(openaiModelConfig["gpt-realtime-2"]).toMatchObject({
			matchingModel: "gpt-realtime-2",
			supportsRealtimeSession: true,
			supportsAudio: true,
			modalities: {
				input: ["text", "audio", "image"],
				output: ["text", "audio"],
			},
		});
		expect(openaiModelConfig["gpt-realtime-translate"]).toMatchObject({
			matchingModel: "gpt-realtime-translate",
			supportsRealtimeTranslationSession: true,
			modalities: {
				input: ["audio"],
				output: ["audio", "text"],
			},
		});
		expect(openaiModelConfig["gpt-realtime-mini"]?.supportsRealtimeSession).toBe(true);
		expect(openaiModelConfig["gpt-audio-1.5"]?.supportsAudio).toBe(true);
		expect(openaiModelConfig["gpt-audio-mini"]?.supportsAudio).toBe(true);
	});
});
