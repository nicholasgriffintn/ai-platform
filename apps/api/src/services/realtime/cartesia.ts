import type { Context } from "hono";

import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { getRealtimeProvider } from "~/lib/providers/capabilities/realtime";
import type { IEnv, IUser } from "~/types";
import {
	base64AudioToBuffer,
	createRealtimeTranscriptionProxyResponse,
	type NormalizedClientRealtimeMessage,
} from "./transcriptionProxy";

export function toCartesiaUpstreamMessage(
	message: NormalizedClientRealtimeMessage,
): string | ArrayBuffer {
	if (message.type === "input_audio.flush") {
		return "finalize";
	}

	if (message.type === "input_audio.end") {
		return "done";
	}

	return base64AudioToBuffer(message.audio);
}

function getString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function toCartesiaClientMessage(data: unknown): string | undefined {
	if (typeof data !== "string") {
		return undefined;
	}

	let payload: Record<string, unknown>;
	try {
		payload = JSON.parse(data);
	} catch {
		return undefined;
	}

	const type = getString(payload.type);
	const text = getString(payload.text);
	if (type === "transcript" && text) {
		return JSON.stringify({
			type: payload.is_final === true ? "transcription.segment" : "transcription.text.delta",
			text,
		});
	}
	if (type === "flush_done" || type === "done") {
		return JSON.stringify({ type: "transcription.done" });
	}
	if (type === "error") {
		return JSON.stringify({ type: "error", error: { message: getString(payload.message) } });
	}

	return data;
}

export async function createCartesiaRealtimeProxyResponse({
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
	const provider = getRealtimeProvider("cartesia", { env, user });
	const apiKey = await provider.getApiKey?.({
		env,
		user,
		type: "transcription",
	});

	if (!apiKey) {
		return ResponseFactory.error(context, "Failed to resolve API key for Cartesia provider", 500);
	}

	const modelToUse = model || provider.getDefaultModel("transcription");
	const upstreamUrl = new URL("/stt/websocket", "https://api.cartesia.ai");
	upstreamUrl.searchParams.set("model", modelToUse);
	upstreamUrl.searchParams.set("encoding", "pcm_s16le");
	upstreamUrl.searchParams.set("sample_rate", "16000");
	if (language) {
		upstreamUrl.searchParams.set("language", language);
	}

	return createRealtimeTranscriptionProxyResponse({
		context,
		providerLabel: "Cartesia",
		upstreamUrl,
		headers: {
			"X-API-Key": apiKey,
			"Cartesia-Version": "2025-04-16",
		},
		toUpstreamMessage: toCartesiaUpstreamMessage,
		toClientMessage: toCartesiaClientMessage,
	});
}
