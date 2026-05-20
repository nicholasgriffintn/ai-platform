import { describe, expect, it } from "vitest";

import {
	getTranscriptionModelOptions,
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
