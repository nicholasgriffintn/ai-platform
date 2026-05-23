import { type Context } from "hono";

import type { IEnv, IUser } from "~/types";
import { bufferToBase64 } from "~/utils/base64";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getRealtimeProvider } from "~/lib/providers/capabilities/realtime";
import { ResponseFactory } from "~/lib/http/ResponseFactory";

function sanitizeMistralClientMessage(data: string): string {
	let payload: unknown;
	try {
		payload = JSON.parse(data);
	} catch {
		throw new AssistantError("Invalid realtime message", ErrorType.PARAMS_ERROR);
	}

	if (!payload || typeof payload !== "object") {
		throw new AssistantError("Invalid realtime message", ErrorType.PARAMS_ERROR);
	}

	const message = payload as Record<string, unknown>;
	const type = message.type;
	const MISTRAL_CLIENT_MESSAGE_TYPES = new Set([
		"input_audio.append",
		"input_audio.flush",
		"input_audio.end",
	]);
	if (typeof type !== "string" || !MISTRAL_CLIENT_MESSAGE_TYPES.has(type)) {
		throw new AssistantError("Unsupported realtime message type", ErrorType.PARAMS_ERROR);
	}

	if (type === "input_audio.append") {
		const audio = message.audio;
		const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
		if (typeof audio !== "string" || !BASE64_PATTERN.test(audio)) {
			throw new AssistantError("Invalid realtime audio payload", ErrorType.PARAMS_ERROR);
		}

		return JSON.stringify({ type, audio });
	}

	return JSON.stringify({ type });
}

function isMistralSessionCreatedMessage(data: unknown): boolean {
	if (typeof data !== "string") {
		return false;
	}

	try {
		const payload = JSON.parse(data) as { type?: unknown };
		return payload.type === "session.created";
	} catch {
		return false;
	}
}

function closeSocket(socket: WebSocket, code = 1000, reason = ""): void {
	try {
		if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
			socket.close(code, reason);
		}
	} catch {
		// close can race with the peer closing first.
	}
}

function normaliseClientMessage(data: unknown): string {
	if (typeof data === "string") {
		return sanitizeMistralClientMessage(data);
	}

	if (data instanceof ArrayBuffer) {
		return JSON.stringify({
			type: "input_audio.append",
			audio: bufferToBase64(data),
		});
	}

	throw new TypeError("Unsupported realtime message payload");
}

function bridgeMistralRealtimeSockets({
	client,
	upstream,
	sessionUpdateMessage,
}: {
	client: WebSocket;
	upstream: WebSocket;
	sessionUpdateMessage: string;
}): void {
	let hasSentSessionUpdate = false;
	const pendingClientMessages: string[] = [];

	const flushPendingClientMessages = () => {
		while (pendingClientMessages.length > 0 && upstream.readyState === WebSocket.OPEN) {
			upstream.send(pendingClientMessages.shift()!);
		}
	};

	client.addEventListener("message", (event) => {
		try {
			const message = normaliseClientMessage(event.data);
			if (!hasSentSessionUpdate) {
				const MISTRAL_PENDING_MESSAGE_LIMIT = 64;
				if (pendingClientMessages.length >= MISTRAL_PENDING_MESSAGE_LIMIT) {
					throw new Error("Upstream session is not ready");
				}
				pendingClientMessages.push(message);
				return;
			}

			upstream.send(message);
		} catch {
			if (client.readyState !== WebSocket.OPEN) {
				return;
			}

			client.send(
				JSON.stringify({
					type: "error",
					error: {
						message: "Invalid realtime message",
						code: 400,
					},
				}),
			);
			closeSocket(client, 1003, "Invalid realtime message");
			closeSocket(upstream, 1003, "Invalid realtime message");
		}
	});

	upstream.addEventListener("message", (event) => {
		if (!hasSentSessionUpdate && isMistralSessionCreatedMessage(event.data)) {
			upstream.send(sessionUpdateMessage);
			hasSentSessionUpdate = true;
			flushPendingClientMessages();
		}

		if (client.readyState === WebSocket.OPEN) {
			client.send(event.data);
		}
	});

	client.addEventListener("close", () => closeSocket(upstream));
	client.addEventListener("error", () => closeSocket(upstream, 1011, "Client socket error"));
	upstream.addEventListener("close", (event) => closeSocket(client, event.code, event.reason));
	upstream.addEventListener("error", () => closeSocket(client, 1011, "Upstream socket error"));
}

export async function createMistralRealtimeProxyResponse({
	context,
	env,
	user,
	model,
}: {
	context: Context;
	env: IEnv;
	user: IUser;
	model?: string;
}): Promise<Response> {
	const request = context.req.raw;
	const isWebSocketUpgrade = request.headers.get("Upgrade")?.toLowerCase() === "websocket";
	if (!isWebSocketUpgrade) {
		return new Response("Expected WebSocket upgrade", {
			status: 426,
			headers: { Upgrade: "websocket" },
		});
	}

	const provider = getRealtimeProvider("mistral", context);

	const apiKey = await provider.getApiKey?.({
		env,
		user,
		type: "transcription",
	});

	if (!apiKey) {
		return ResponseFactory.error(context, "Failed to resolve API key for Mistral provider", 500);
	}

	const modelToUse = model || provider.getDefaultModel("transcription");

	if (!modelToUse) {
		return ResponseFactory.error(context, "Failed to resolve model for Mistral provider", 500);
	}

	const url = new URL("/v1/audio/transcriptions/realtime", "https://api.mistral.ai");
	url.searchParams.set("model", modelToUse);

	const upstreamResponse = await fetch(url, {
		headers: {
			Authorization: `Bearer ${apiKey}`,
			Upgrade: "websocket",
		},
	});

	if (upstreamResponse.status !== 101 || !upstreamResponse.webSocket) {
		return new Response("Failed to connect to Mistral realtime", { status: 502 });
	}

	const pair = new WebSocketPair();
	const [clientSocket, serverSocket] = Object.values(pair);
	serverSocket.accept();
	upstreamResponse.webSocket.accept();

	const audioFormat = provider.buildAudioFormat ? provider.buildAudioFormat() : undefined;
	const targetStreamingDelayMs = provider.getTranscriptionDelay
		? provider.getTranscriptionDelay({
				env,
				user,
				type: "transcription",
			})
		: undefined;

	bridgeMistralRealtimeSockets({
		client: serverSocket,
		upstream: upstreamResponse.webSocket,
		sessionUpdateMessage: JSON.stringify({
			type: "session.update",
			session: {
				audio_format: audioFormat,
				...(targetStreamingDelayMs ? { target_streaming_delay_ms: targetStreamingDelayMs } : {}),
			},
		}),
	});

	return new Response(null, {
		status: 101,
		webSocket: clientSocket,
	});
}
