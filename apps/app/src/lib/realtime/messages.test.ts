import { describe, expect, it } from "vitest";

import {
	extractGeminiAudioChunks,
	extractRealtimeTranscript,
	parseRealtimeJsonMessage,
} from "./messages";

describe("realtime message helpers", () => {
	it("extracts OpenAI-style completed transcription messages", () => {
		const transcript = extractRealtimeTranscript({
			type: "conversation.item.input_audio_transcription.completed",
			transcript: "Book the train for noon.",
		});

		expect(transcript).toEqual({
			text: "Book the train for noon.",
			isFinal: true,
			source: "input",
		});
	});

	it("extracts Gemini audio chunks from server content", () => {
		expect(
			extractGeminiAudioChunks({
				serverContent: {
					modelTurn: {
						parts: [
							{
								inlineData: {
									mimeType: "audio/pcm;rate=24000",
									data: "AAAA",
								},
							},
						],
					},
				},
			}),
		).toEqual(["AAAA"]);
	});

	it("ignores malformed JSON messages", () => {
		expect(parseRealtimeJsonMessage("{")).toBeUndefined();
	});
});
