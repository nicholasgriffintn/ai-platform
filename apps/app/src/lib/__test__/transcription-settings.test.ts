import { describe, expect, it } from "vitest";

import {
	getSpeechModelOptions,
	getTranscriptionModelOptions,
	resolveSpeechSettings,
	resolveTranscriptionSettings,
} from "../transcription-settings";

describe("transcription settings", () => {
	it("keeps saved Mistral transcription settings selectable", () => {
		expect(resolveTranscriptionSettings("mistral", "voxtral-mini")).toEqual({
			transcription_provider: "mistral",
			transcription_model: "voxtral-mini",
		});

		expect(getTranscriptionModelOptions("mistral")).toEqual([
			{ id: "voxtral-mini", label: "Voxtral Mini" },
		]);
	});

	it("falls back to a valid provider model pair", () => {
		expect(resolveTranscriptionSettings("mistral", "whisper")).toEqual({
			transcription_provider: "mistral",
			transcription_model: "voxtral-mini",
		});

		expect(resolveTranscriptionSettings("unknown", "voxtral-mini")).toEqual({
			transcription_provider: "workers",
			transcription_model: "whisper",
		});
	});
});

describe("speech settings", () => {
	it("keeps saved Cartesia speech settings selectable", () => {
		expect(resolveSpeechSettings("cartesia", "sonic-3")).toEqual({
			speech_provider: "cartesia",
			speech_model: "sonic-3",
		});

		expect(getSpeechModelOptions("cartesia")).toEqual([{ id: "sonic-3", label: "Sonic 3" }]);
	});

	it("falls back to a valid speech provider model pair", () => {
		expect(resolveSpeechSettings("cartesia", "unknown")).toEqual({
			speech_provider: "cartesia",
			speech_model: "sonic-3",
		});

		expect(resolveSpeechSettings("unknown", "sonic-3")).toEqual({
			speech_provider: "melotts",
			speech_model: "@cf/myshell-ai/melotts",
		});
	});
});
