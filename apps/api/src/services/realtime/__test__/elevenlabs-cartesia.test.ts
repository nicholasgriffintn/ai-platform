import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";
import {
	createElevenLabsClientMessageMapper,
	createElevenLabsRealtimeProxyResponse,
	createElevenLabsUpstreamMessageMapper,
	toElevenLabsClientMessage,
} from "~/services/realtime/elevenlabs";
import {
	createCartesiaRealtimeProxyResponse,
	toCartesiaClientMessage,
	toCartesiaUpstreamMessage,
} from "~/services/realtime/cartesia";
import { base64AudioToBuffer } from "~/services/realtime/transcriptionProxy";
import { bufferToBase64 } from "~/utils/base64";

const createRealtimeTranscriptionProxyResponseMock = vi.hoisted(() => vi.fn());
const getApiKeyMock = vi.hoisted(() => vi.fn());
const getDefaultModelMock = vi.hoisted(() => vi.fn());

const testEnv = {} as IEnv;
const testUser = {
	id: 1,
	name: null,
	avatar_url: null,
	email: "test@example.com",
	github_username: null,
	company: null,
	site: null,
	location: null,
	bio: null,
	twitter_username: null,
	created_at: "2026-05-27T00:00:00.000Z",
	updated_at: "2026-05-27T00:00:00.000Z",
	setup_at: null,
	terms_accepted_at: null,
	plan_id: null,
} satisfies IUser;

vi.mock("~/lib/providers/capabilities/realtime", () => ({
	getRealtimeProvider: vi.fn(() => ({
		getApiKey: getApiKeyMock,
		getDefaultModel: getDefaultModelMock,
	})),
}));

vi.mock("~/services/realtime/transcriptionProxy", async (importOriginal) => {
	const original = await importOriginal<typeof import("~/services/realtime/transcriptionProxy")>();
	return {
		...original,
		createRealtimeTranscriptionProxyResponse: createRealtimeTranscriptionProxyResponseMock,
	};
});

async function requestElevenLabsProxyResponse(): Promise<Response> {
	const app = new Hono();
	app.get("/realtime/elevenlabs/transcription", (context) =>
		createElevenLabsRealtimeProxyResponse({
			context,
			env: testEnv,
			user: testUser,
			model: "scribe_v2_realtime",
			language: "en",
		}),
	);

	return app.request("https://api.polychat.test/realtime/elevenlabs/transcription");
}

async function requestCartesiaProxyResponse(): Promise<Response> {
	const app = new Hono();
	app.get("/realtime/cartesia/transcription", (context) =>
		createCartesiaRealtimeProxyResponse({
			context,
			env: testEnv,
			user: testUser,
			model: "ink-whisper",
			language: "en",
		}),
	);

	return app.request("https://api.polychat.test/realtime/cartesia/transcription");
}

function parseSingleClientMessage(message: string | string[] | undefined): Record<string, unknown> {
	if (typeof message !== "string") {
		throw new Error("Expected a single client message");
	}

	return JSON.parse(message);
}

function parseClientMessages(message: string | string[] | undefined): Record<string, unknown>[] {
	if (!Array.isArray(message)) {
		throw new Error("Expected multiple client messages");
	}

	return message.map((item) => JSON.parse(item));
}

describe("ElevenLabs realtime proxy", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getApiKeyMock.mockResolvedValue("test-key");
		getDefaultModelMock.mockReturnValue("scribe_v2_realtime");
		createRealtimeTranscriptionProxyResponseMock.mockResolvedValue(
			new Response(null, { status: 200 }),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("creates a Scribe realtime upstream handshake without exposing the API key to clients", async () => {
		const response = await requestElevenLabsProxyResponse();

		expect(response.status).toBe(200);
		expect(createRealtimeTranscriptionProxyResponseMock).toHaveBeenCalledWith(
			expect.objectContaining({
				providerLabel: "ElevenLabs",
				upstreamUrl: expect.objectContaining({
					href: "https://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&commit_strategy=vad&language_code=en",
				}),
				headers: { "xi-api-key": "test-key" },
			}),
		);
	});

	it("normalises client and provider messages", () => {
		const toElevenLabsUpstreamMessage = createElevenLabsUpstreamMessageMapper();
		const commitReadyAudio = bufferToBase64(new Uint8Array(9600));

		expect(
			JSON.parse(
				toElevenLabsUpstreamMessage({
					type: "input_audio.append",
					audio: commitReadyAudio,
				}) ?? "",
			),
		).toEqual({
			message_type: "input_audio_chunk",
			audio_base_64: commitReadyAudio,
			commit: false,
			sample_rate: 16000,
		});
		expect(JSON.parse(toElevenLabsUpstreamMessage({ type: "input_audio.flush" }) ?? "")).toEqual({
			message_type: "input_audio_chunk",
			commit: true,
			sample_rate: 16000,
		});
		expect(
			parseSingleClientMessage(
				toElevenLabsClientMessage(
					JSON.stringify({ message_type: "partial_transcript", text: "hello" }),
				),
			),
		).toMatchObject({ type: "transcription.text", text: "hello" });

		const committedMessages = toElevenLabsClientMessage(
			JSON.stringify({
				message_type: "committed_transcript_with_timestamps",
				text: "hello world",
			}),
		);
		expect(parseClientMessages(committedMessages)).toEqual([
			expect.objectContaining({ type: "transcription.segment", text: "hello world" }),
			expect.objectContaining({ type: "transcription.done" }),
		]);
	});

	it("keeps ElevenLabs partial, committed, and timestamp events on one synthetic segment", () => {
		const toElevenLabsClientMessage = createElevenLabsClientMessageMapper();
		const partial = parseSingleClientMessage(
			toElevenLabsClientMessage(
				JSON.stringify({ message_type: "partial_transcript", text: "hello wor" }),
			),
		);
		const committed = parseClientMessages(
			toElevenLabsClientMessage(
				JSON.stringify({ message_type: "committed_transcript", text: "hello world" }),
			),
		);
		const committedWithTimestamps = parseClientMessages(
			toElevenLabsClientMessage(
				JSON.stringify({
					message_type: "committed_transcript_with_timestamps",
					text: "hello world",
					words: [],
				}),
			),
		);

		expect(partial).toMatchObject({
			type: "transcription.text",
			item_id: expect.stringMatching(/^elevenlabs-/),
			text: "hello wor",
		});
		expect(committed).toEqual([
			{
				type: "transcription.segment",
				item_id: partial.item_id,
				text: "hello world",
			},
			{
				type: "transcription.done",
				item_id: partial.item_id,
			},
		]);
		expect(committedWithTimestamps).toEqual(committed);

		const nextPartial = parseSingleClientMessage(
			toElevenLabsClientMessage(
				JSON.stringify({ message_type: "partial_transcript", text: "next" }),
			),
		);
		expect(nextPartial.item_id).not.toBe(partial.item_id);
	});

	it("does not commit ElevenLabs audio before the minimum commit window", () => {
		const toElevenLabsUpstreamMessage = createElevenLabsUpstreamMessageMapper();
		const shortAudio = bufferToBase64(new Uint8Array(2880));

		expect(
			JSON.parse(
				toElevenLabsUpstreamMessage({
					type: "input_audio.append",
					audio: shortAudio,
				}) ?? "",
			),
		).toMatchObject({
			message_type: "input_audio_chunk",
			audio_base_64: shortAudio,
			commit: false,
		});
		expect(toElevenLabsUpstreamMessage({ type: "input_audio.flush" })).toBeNull();
		expect(toElevenLabsUpstreamMessage({ type: "input_audio.end" })).toBeNull();
	});
});

describe("Cartesia realtime proxy", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getApiKeyMock.mockResolvedValue("test-key");
		getDefaultModelMock.mockReturnValue("ink-whisper");
		createRealtimeTranscriptionProxyResponseMock.mockResolvedValue(
			new Response(null, { status: 200 }),
		);
	});

	it("creates an Ink realtime upstream handshake without exposing the API key to clients", async () => {
		const response = await requestCartesiaProxyResponse();

		expect(response.status).toBe(200);
		expect(createRealtimeTranscriptionProxyResponseMock).toHaveBeenCalledWith(
			expect.objectContaining({
				providerLabel: "Cartesia",
				upstreamUrl: expect.objectContaining({
					href: "https://api.cartesia.ai/stt/websocket?model=ink-whisper&encoding=pcm_s16le&sample_rate=16000&language=en",
				}),
				headers: {
					"X-API-Key": "test-key",
					"Cartesia-Version": "2025-04-16",
				},
			}),
		);
	});

	it("normalises client and provider messages", () => {
		expect(toCartesiaUpstreamMessage({ type: "input_audio.flush" })).toBe("finalize");
		expect(toCartesiaUpstreamMessage({ type: "input_audio.end" })).toBe("done");
		expect(toCartesiaUpstreamMessage({ type: "input_audio.append", audio: "AQID" })).toEqual(
			base64AudioToBuffer("AQID"),
		);
		expect(
			JSON.parse(
				toCartesiaClientMessage(
					JSON.stringify({ type: "transcript", is_final: false, text: "hello" }),
				) ?? "",
			),
		).toEqual({ type: "transcription.text.delta", text: "hello" });
		expect(
			JSON.parse(
				toCartesiaClientMessage(
					JSON.stringify({ type: "transcript", is_final: true, text: "hello world" }),
				) ?? "",
			),
		).toEqual({ type: "transcription.segment", text: "hello world" });
		expect(JSON.parse(toCartesiaClientMessage(JSON.stringify({ type: "done" })) ?? "")).toEqual({
			type: "transcription.done",
		});
	});
});
