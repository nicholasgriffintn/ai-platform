import type { Context } from "hono";

import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { getRealtimeProvider } from "~/lib/providers/capabilities/realtime";
import type { IEnv, IUser } from "~/types";
import { base64ToBuffer } from "~/utils/base64";
import { generateId } from "~/utils/id";
import {
	createRealtimeTranscriptionProxyResponse,
	type NormalizedClientRealtimeMessage,
} from "./transcriptionProxy";

const ELEVENLABS_SAMPLE_RATE = 16000;
const PCM_S16LE_BYTES_PER_SAMPLE = 2;
const MIN_COMMIT_AUDIO_MS = 300;
const MIN_COMMIT_AUDIO_BYTES =
	(ELEVENLABS_SAMPLE_RATE * PCM_S16LE_BYTES_PER_SAMPLE * MIN_COMMIT_AUDIO_MS) / 1000;

type ElevenLabsUpstreamMessageMapper = (message: NormalizedClientRealtimeMessage) => string | null;
type ElevenLabsClientMessageMapper = (message: unknown) => string | string[] | undefined;

function createInputAudioChunkMessage({
	audio,
	commit,
}: {
	audio?: string;
	commit: boolean;
}): string {
	return JSON.stringify({
		message_type: "input_audio_chunk",
		...(audio ? { audio_base_64: audio } : {}),
		commit,
		sample_rate: ELEVENLABS_SAMPLE_RATE,
	});
}

export function createElevenLabsUpstreamMessageMapper(): ElevenLabsUpstreamMessageMapper {
	let uncommittedAudioBytes = 0;

	return (message) => {
		if (message.type === "input_audio.append") {
			uncommittedAudioBytes += base64ToBuffer(message.audio).byteLength;
			return createInputAudioChunkMessage({ audio: message.audio, commit: false });
		}

		if (message.type === "input_audio.flush" || message.type === "input_audio.end") {
			if (uncommittedAudioBytes < MIN_COMMIT_AUDIO_BYTES) {
				return null;
			}

			uncommittedAudioBytes = 0;
			return createInputAudioChunkMessage({ commit: true });
		}

		return null;
	};
}

export function toElevenLabsUpstreamMessage(
	message: NormalizedClientRealtimeMessage,
): string | null {
	return createElevenLabsUpstreamMessageMapper()(message);
}

function createSegmentId(): string {
	return `elevenlabs-${generateId()}`;
}

function getString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function createElevenLabsClientMessageMapper(): ElevenLabsClientMessageMapper {
	let currentSegmentId = createSegmentId();
	let committedSegment: { itemId: string; text: string } | undefined;

	const getActiveSegmentId = () => {
		if (committedSegment) {
			currentSegmentId = createSegmentId();
			committedSegment = undefined;
		}

		return currentSegmentId;
	};

	const getCommittedSegmentId = (text: string) => {
		if (committedSegment?.text === text) {
			return committedSegment.itemId;
		}
		if (committedSegment) {
			currentSegmentId = createSegmentId();
		}

		committedSegment = { itemId: currentSegmentId, text };
		return currentSegmentId;
	};

	return (data) => {
		if (typeof data !== "string") {
			return undefined;
		}

		let payload: Record<string, unknown>;
		try {
			payload = JSON.parse(data);
		} catch {
			return undefined;
		}

		const messageType = getString(payload.message_type);
		const text = getString(payload.text);
		if (messageType === "partial_transcript" && text) {
			return JSON.stringify({
				type: "transcription.text",
				item_id: getActiveSegmentId(),
				text,
			});
		}
		if (
			(messageType === "committed_transcript" ||
				messageType === "committed_transcript_with_timestamps" ||
				messageType === "final_transcript") &&
			text
		) {
			const itemId = getCommittedSegmentId(text);
			return [
				JSON.stringify({ type: "transcription.segment", item_id: itemId, text }),
				JSON.stringify({ type: "transcription.done", item_id: itemId }),
			];
		}
		if (messageType === "session_started") {
			return JSON.stringify({ type: "session.created" });
		}
		if (messageType === "error") {
			return JSON.stringify({ type: "error", error: { message: getString(payload.message) } });
		}

		return data;
	};
}

export function toElevenLabsClientMessage(data: unknown): string | string[] | undefined {
	return createElevenLabsClientMessageMapper()(data);
}

export async function createElevenLabsRealtimeProxyResponse({
	context,
	env,
	user,
	model,
	language,
}: {
	context: Context;
	env: IEnv;
	user: IUser;
	model?: string;
	language?: string;
}): Promise<Response> {
	const provider = getRealtimeProvider("elevenlabs", { env, user });
	const apiKey = await provider.getApiKey?.({
		env,
		user,
		type: "transcription",
	});

	if (!apiKey) {
		return ResponseFactory.error(context, "Failed to resolve API key for ElevenLabs provider", 500);
	}

	const modelToUse = model || provider.getDefaultModel("transcription");
	const upstreamUrl = new URL("/v1/speech-to-text/realtime", "https://api.elevenlabs.io");
	upstreamUrl.searchParams.set("model_id", modelToUse);
	if (language) {
		upstreamUrl.searchParams.set("language_code", language);
	}

	return createRealtimeTranscriptionProxyResponse({
		context,
		providerLabel: "ElevenLabs",
		upstreamUrl,
		headers: { "xi-api-key": apiKey },
		toUpstreamMessage: createElevenLabsUpstreamMessageMapper(),
		toClientMessage: createElevenLabsClientMessageMapper(),
	});
}
