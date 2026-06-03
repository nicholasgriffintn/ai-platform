import { describe, expect, it } from "vitest";

import {
	extractRealtimeErrorMessage,
	extractRealtimeEvent,
	extractRealtimeEventLabel,
	extractInlineAudioChunks,
	extractRealtimeTranscript,
	isRealtimeSetupCompleteMessage,
	parseRealtimeJsonMessage,
	parseRealtimeMessageData,
} from "./messages";

describe("realtime message helpers", () => {
	it("extracts OpenAI-style completed transcription messages", () => {
		const transcript = extractRealtimeTranscript({
			type: "conversation.item.input_audio_transcription.completed",
			item_id: "input-item-1",
			transcript: "Book the train for noon.",
		});

		expect(transcript).toEqual({
			text: "Book the train for noon.",
			isDelta: false,
			isFinal: true,
			itemId: "input-item-1",
			source: "input",
		});
	});

	it("marks Realtime transcript deltas", () => {
		const transcript = extractRealtimeTranscript({
			type: "response.output_audio_transcript.delta",
			response_id: "response-1",
			delta: "Hello",
		});

		expect(transcript).toEqual({
			text: "Hello",
			isDelta: true,
			isFinal: false,
			responseId: "response-1",
			source: "output",
		});
	});

	it("extracts Mistral realtime transcription text deltas as input transcripts", () => {
		const transcript = extractRealtimeTranscript({
			type: "transcription.text.delta",
			text: "Hello",
		});

		expect(transcript).toEqual({
			text: "Hello",
			isDelta: true,
			isFinal: false,
			source: "input",
		});
	});

	it("extracts realtime transcription text snapshots as replaceable interim input transcripts", () => {
		const transcript = extractRealtimeTranscript({
			type: "transcription.text",
			text: "Hello there",
		});

		expect(transcript).toEqual({
			text: "Hello there",
			isDelta: false,
			isFinal: false,
			source: "input",
		});
	});

	it("extracts Mistral realtime transcription segments as final input transcripts", () => {
		const transcript = extractRealtimeTranscript({
			type: "transcription.segment",
			text: "Hello there.",
			start: 0,
			end: 1.2,
		});

		expect(transcript).toEqual({
			text: "Hello there.",
			isDelta: false,
			isFinal: true,
			source: "input",
		});
	});

	it("extracts realtime event ids for live turn correlation", () => {
		expect(
			extractRealtimeEvent({
				type: "input_audio_buffer.committed",
				item_id: "input-item-1",
			}),
		).toEqual({
			type: "input_audio_buffer.committed",
			label: "Speech captured",
			itemId: "input-item-1",
		});

		expect(
			extractRealtimeEvent({
				type: "response.created",
				response: {
					id: "response-1",
				},
			}),
		).toEqual({
			type: "response.created",
			label: "Assistant responding",
			responseId: "response-1",
		});
	});

	it("extracts inline audio chunks from server content", () => {
		expect(
			extractInlineAudioChunks({
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

	it("extracts Gemini model text from server content", () => {
		expect(
			extractRealtimeTranscript({
				serverContent: {
					modelTurn: {
						parts: [{ text: "Hello" }, { text: " there" }],
					},
				},
			}),
		).toEqual({
			text: "Hello there",
			isDelta: true,
			isFinal: false,
			source: "output",
		});
	});

	it("marks Gemini server content complete only when the turn completes", () => {
		expect(
			extractRealtimeTranscript({
				serverContent: {
					outputTranscription: {
						text: "Final words",
					},
					turnComplete: true,
				},
			}),
		).toEqual({
			text: "Final words",
			isDelta: true,
			isFinal: true,
			source: "output",
		});
		expect(
			extractRealtimeEvent({
				serverContent: {
					turnComplete: true,
				},
			}),
		).toEqual({
			type: "response.done",
			label: "Assistant response complete",
		});
	});

	it("maps Gemini interrupted server content to a realtime event", () => {
		expect(
			extractRealtimeEvent({
				serverContent: {
					interrupted: true,
				},
			}),
		).toEqual({
			type: "response.interrupted",
			label: "Assistant interrupted",
		});
	});

	it("ignores malformed JSON messages", () => {
		expect(parseRealtimeJsonMessage("{")).toBeUndefined();
	});

	it("parses binary JSON message data", async () => {
		const payload = JSON.stringify({ setupComplete: {} });

		await expect(parseRealtimeMessageData(new Blob([payload]))).resolves.toEqual({
			setupComplete: {},
		});
		await expect(
			parseRealtimeMessageData(new TextEncoder().encode(payload).buffer),
		).resolves.toEqual({
			setupComplete: {},
		});
	});

	it("extracts Realtime error messages", () => {
		expect(
			extractRealtimeErrorMessage({
				type: "error",
				error: {
					message: "Session failed",
				},
			}),
		).toBe("Session failed");
		expect(
			extractRealtimeErrorMessage({
				type: "invalid_request_error",
				message: "Unsupported event",
			}),
		).toBe("Unsupported event");
	});

	it("labels realtime lifecycle events without provider-specific copy", () => {
		expect(
			extractRealtimeEventLabel({
				type: "session.created",
			}),
		).toBe("Realtime session ready");
		expect(
			extractRealtimeEventLabel({
				type: "input_audio_buffer.speech_started",
			}),
		).toBe("Listening");
		expect(
			extractRealtimeEventLabel({
				type: "response.output_audio.delta",
			}),
		).toBe("Assistant speaking");
		expect(
			extractRealtimeEventLabel({
				type: "response.output_audio_transcript.delta",
			}),
		).toBeUndefined();
	});

	it("detects realtime setup complete messages by payload shape", () => {
		expect(isRealtimeSetupCompleteMessage({ setupComplete: {} })).toBe(true);
		expect(isRealtimeSetupCompleteMessage({ setup_complete: {} })).toBe(true);
		expect(isRealtimeSetupCompleteMessage({ serverContent: {} })).toBe(false);
	});
});
