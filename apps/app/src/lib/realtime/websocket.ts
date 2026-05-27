import type { RealtimeConnection, RealtimeSession } from "./types";

export interface RealtimeWebSocketConnection extends RealtimeConnection {
	socket: WebSocket;
	sendJson: (payload: unknown) => void;
}

export interface ConnectRealtimeWebSocketOptions {
	session: RealtimeSession;
	protocols?: string | string[];
	onOpen?: (event: Event) => void;
	onMessage?: (event: MessageEvent) => void;
	onError?: (event: Event) => void;
	onClose?: (event: CloseEvent) => void;
}

function requireWebSocketUrl(session: RealtimeSession): string {
	if (!session.url) {
		throw new Error("Realtime WebSocket session is missing a URL");
	}

	return session.url;
}

function validateWebSocketSession(session: RealtimeSession): void {
	if (session.transport && session.transport !== "websocket") {
		throw new Error(`Expected a WebSocket realtime session, received ${session.transport}`);
	}
}

export function connectRealtimeWebSocket({
	session,
	protocols,
	onOpen,
	onMessage,
	onError,
	onClose,
}: ConnectRealtimeWebSocketOptions): RealtimeWebSocketConnection {
	validateWebSocketSession(session);
	const socket = new WebSocket(requireWebSocketUrl(session), protocols);

	if (onOpen) {
		socket.addEventListener("open", onOpen);
	}
	if (onMessage) {
		socket.addEventListener("message", onMessage);
	}
	if (onError) {
		socket.addEventListener("error", onError);
	}
	if (onClose) {
		socket.addEventListener("close", onClose);
	}

	return {
		session,
		socket,
		sendJson: (payload: unknown) => socket.send(JSON.stringify(payload)),
		close: () => socket.close(),
	};
}

export function connectGeminiLiveWebSocket(
	options: ConnectRealtimeWebSocketOptions,
): RealtimeWebSocketConnection {
	const { session } = options;
	if (session.provider && session.provider !== "google-ai-studio") {
		throw new Error(`Expected a Gemini Live session, received ${session.provider}`);
	}

	if (session.protocol && session.protocol !== "gemini-live") {
		throw new Error(`Expected a Gemini Live protocol session, received ${session.protocol}`);
	}

	return connectRealtimeWebSocket(options);
}
