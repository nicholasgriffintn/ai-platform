import { afterEach, describe, expect, it, vi } from "vitest";

import {
	connectGeminiLiveWebSocket,
	connectRealtimeWebSocket,
	isRealtimeWebSocketConnection,
	sendJsonWhenOpen,
} from "./websocket";

class FakeWebSocket extends EventTarget {
	static CLOSED = 3;
	static OPEN = 1;

	sent: string[] = [];
	closed = false;
	readyState = FakeWebSocket.OPEN;

	constructor(
		public url: string,
		public protocols?: string | string[],
	) {
		super();
	}

	send(data: string) {
		this.sent.push(data);
	}

	close() {
		this.closed = true;
		this.readyState = FakeWebSocket.CLOSED;
	}
}

describe("realtime websocket clients", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("opens Gemini Live WebSocket sessions and sends JSON messages", () => {
		vi.stubGlobal("WebSocket", FakeWebSocket);

		const connection = connectGeminiLiveWebSocket({
			session: {
				provider: "google-ai-studio",
				transport: "websocket",
				protocol: "gemini-live",
				url: "wss://generativelanguage.googleapis.com/ws/live",
			},
		});

		connection.sendJson({ realtimeInput: { text: "hello" } });
		connection.close();

		expect(connection.socket).toBeInstanceOf(FakeWebSocket);
		expect((connection.socket as unknown as FakeWebSocket).sent).toEqual([
			JSON.stringify({ realtimeInput: { text: "hello" } }),
		]);
		expect((connection.socket as unknown as FakeWebSocket).closed).toBe(true);
	});

	it("identifies WebSocket connections and sends only while open", () => {
		vi.stubGlobal("WebSocket", FakeWebSocket);

		const connection = connectRealtimeWebSocket({
			session: {
				transport: "websocket",
				url: "wss://example.test/live",
			},
		});

		expect(isRealtimeWebSocketConnection(connection)).toBe(true);
		expect(isRealtimeWebSocketConnection(null)).toBe(false);

		sendJsonWhenOpen(connection, { type: "input_audio.flush" });
		connection.close();
		sendJsonWhenOpen(connection, { type: "input_audio.end" });

		expect((connection.socket as unknown as FakeWebSocket).sent).toEqual([
			JSON.stringify({ type: "input_audio.flush" }),
		]);
	});

	it("rejects non-WebSocket sessions before opening a socket", () => {
		const websocketConstructor = vi.fn();
		vi.stubGlobal("WebSocket", websocketConstructor);

		expect(() =>
			connectRealtimeWebSocket({
				session: {
					transport: "webrtc",
					url: "https://api.openai.com/v1/realtime/calls",
				},
			}),
		).toThrow("Expected a WebSocket realtime session");
		expect(websocketConstructor).not.toHaveBeenCalled();
	});

	it("rejects non-Gemini sessions in the Gemini helper", () => {
		const websocketConstructor = vi.fn();
		vi.stubGlobal("WebSocket", websocketConstructor);

		expect(() =>
			connectGeminiLiveWebSocket({
				session: {
					provider: "openai",
					transport: "websocket",
					protocol: "gemini-live",
					url: "wss://example.test/live",
				},
			}),
		).toThrow("Expected a Gemini Live session");
		expect(websocketConstructor).not.toHaveBeenCalled();
	});
});
