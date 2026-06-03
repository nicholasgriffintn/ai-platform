import type { Context } from "hono";

import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { formatProviderError } from "~/lib/providers/utils/errors";
import { base64ToBuffer, bufferToBase64 } from "~/utils/base64";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/realtime/transcription-proxy" });
const CLIENT_MESSAGE_TYPES = new Set([
	"input_audio.append",
	"input_audio.flush",
	"input_audio.end",
]);
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export interface RealtimeTranscriptionProxyOptions {
	context: Context;
	providerLabel: string;
	upstreamUrl: URL;
	headers: Record<string, string>;
	toUpstreamMessage: (message: NormalizedClientRealtimeMessage) => string | ArrayBuffer | null;
	toClientMessage: (message: unknown) => string | string[] | undefined;
}

export type NormalizedClientRealtimeMessage =
	| { type: "input_audio.append"; audio: string }
	| { type: "input_audio.flush" }
	| { type: "input_audio.end" };

function closeSocket(socket: WebSocket, code = 1000, reason = ""): void {
	try {
		if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
			socket.close(code, reason);
		}
	} catch {
		// close can race with the peer closing first.
	}
}

function parseJson(data: unknown): unknown {
	if (typeof data !== "string") {
		return undefined;
	}

	try {
		return JSON.parse(data);
	} catch {
		return undefined;
	}
}

function normalizeClientMessage(data: unknown): NormalizedClientRealtimeMessage {
	if (data instanceof ArrayBuffer) {
		return {
			type: "input_audio.append",
			audio: bufferToBase64(data),
		};
	}

	const payload = parseJson(data);
	if (!payload || typeof payload !== "object") {
		throw new AssistantError("Invalid realtime message", ErrorType.PARAMS_ERROR);
	}

	const message = payload as Record<string, unknown>;
	const type = message.type;
	if (typeof type !== "string" || !CLIENT_MESSAGE_TYPES.has(type)) {
		throw new AssistantError("Unsupported realtime message type", ErrorType.PARAMS_ERROR);
	}

	if (type === "input_audio.flush") {
		return { type: "input_audio.flush" };
	}

	if (type === "input_audio.end") {
		return { type: "input_audio.end" };
	}

	const audio = message.audio;
	if (typeof audio !== "string" || !BASE64_PATTERN.test(audio)) {
		throw new AssistantError("Invalid realtime audio payload", ErrorType.PARAMS_ERROR);
	}

	return { type: "input_audio.append", audio };
}

function getProxyFailureStatus(providerStatus: number): 400 | 401 | 403 | 404 | 429 | 502 {
	switch (providerStatus) {
		case 400:
		case 401:
		case 403:
		case 404:
		case 429:
			return providerStatus;
		default:
			return 502;
	}
}

function sendClientError(client: WebSocket): void {
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
}

function bridgeRealtimeTranscriptionSockets({
	client,
	upstream,
	toUpstreamMessage,
	toClientMessage,
}: {
	client: WebSocket;
	upstream: WebSocket;
	toUpstreamMessage: RealtimeTranscriptionProxyOptions["toUpstreamMessage"];
	toClientMessage: RealtimeTranscriptionProxyOptions["toClientMessage"];
}): void {
	client.addEventListener("message", (event) => {
		try {
			const message = normalizeClientMessage(event.data);
			const upstreamMessage = toUpstreamMessage(message);
			if (upstreamMessage !== null && upstream.readyState === WebSocket.OPEN) {
				upstream.send(upstreamMessage);
			}
		} catch {
			sendClientError(client);
			closeSocket(client, 1003, "Invalid realtime message");
			closeSocket(upstream, 1003, "Invalid realtime message");
		}
	});

	upstream.addEventListener("message", (event) => {
		if (client.readyState !== WebSocket.OPEN) {
			return;
		}

		const clientMessage = toClientMessage(event.data);
		if (Array.isArray(clientMessage)) {
			for (const message of clientMessage) {
				client.send(message);
			}
		} else if (clientMessage) {
			client.send(clientMessage);
		}
	});

	client.addEventListener("close", () => closeSocket(upstream));
	client.addEventListener("error", () => closeSocket(upstream, 1011, "Client socket error"));
	upstream.addEventListener("close", (event) => closeSocket(client, event.code, event.reason));
	upstream.addEventListener("error", () => closeSocket(client, 1011, "Upstream socket error"));
}

export function base64AudioToBuffer(base64Audio: string): ArrayBuffer {
	const bytes = base64ToBuffer(base64Audio);
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	return buffer;
}

export async function createRealtimeTranscriptionProxyResponse({
	context,
	headers,
	providerLabel,
	toClientMessage,
	toUpstreamMessage,
	upstreamUrl,
}: RealtimeTranscriptionProxyOptions): Promise<Response> {
	const request = context.req.raw;
	const isWebSocketUpgrade = request.headers.get("Upgrade")?.toLowerCase() === "websocket";
	if (!isWebSocketUpgrade) {
		return new Response("Expected WebSocket upgrade", {
			status: 426,
			headers: { Upgrade: "websocket" },
		});
	}

	const upstreamResponse = await fetch(upstreamUrl, {
		headers: {
			...headers,
			Upgrade: "websocket",
		},
	});

	if (upstreamResponse.status !== 101 || !upstreamResponse.webSocket) {
		const providerError = await formatProviderError(
			upstreamResponse,
			`Failed to connect to ${providerLabel} realtime`,
		);
		logger.error(`${providerLabel} realtime handshake failed`, {
			providerStatus: upstreamResponse.status,
			providerStatusText: upstreamResponse.statusText,
			providerResponse: providerError,
		});

		return ResponseFactory.error(
			context,
			providerError,
			getProxyFailureStatus(upstreamResponse.status),
		);
	}

	const pair = new WebSocketPair();
	const [clientSocket, serverSocket] = Object.values(pair);
	serverSocket.accept();
	upstreamResponse.webSocket.accept();

	bridgeRealtimeTranscriptionSockets({
		client: serverSocket,
		upstream: upstreamResponse.webSocket,
		toClientMessage,
		toUpstreamMessage,
	});

	return new Response(null, {
		status: 101,
		webSocket: clientSocket,
	});
}
