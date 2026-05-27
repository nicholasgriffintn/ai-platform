import { afterEach, describe, expect, it, vi } from "vitest";

import { buildRealtimeSessionPath, createRealtimeSession } from "./realtime-service";

describe("realtime-service", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("builds provider-specific realtime session paths", () => {
		const path = buildRealtimeSessionPath({
			type: "realtime",
			provider: "google-ai-studio",
			model: "gemini-3.1-flash-live-preview",
			transport: "websocket",
			inputModalities: ["audio", "video"],
			outputModalities: ["audio"],
			voice: "Puck",
			instructions: "Be concise.",
		});

		expect(path).toBe(
			"/realtime/session/realtime?provider=google-ai-studio&model=gemini-3.1-flash-live-preview&transport=websocket&voice=Puck&instructions=Be+concise.&input_modalities=audio%2Cvideo&output_modalities=audio",
		);
	});

	it("creates realtime sessions through the API wrapper", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			Response.json({
				id: "authTokens/live-token",
				transport: "websocket",
				protocol: "gemini-live",
				url: "wss://generativelanguage.googleapis.com/ws/live",
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const session = await createRealtimeSession({
			type: "realtime",
			provider: "google-ai-studio",
			transport: "websocket",
			inputModalities: ["audio", "video"],
			outputModalities: ["audio"],
			timeoutMs: null,
		});

		expect(session).toMatchObject({
			id: "authTokens/live-token",
			transport: "websocket",
			protocol: "gemini-live",
		});
		expect(String(fetchMock.mock.calls[0][0])).toContain(
			"/realtime/session/realtime?provider=google-ai-studio&transport=websocket&input_modalities=audio%2Cvideo&output_modalities=audio",
		);
		expect(fetchMock.mock.calls[0][1]).toMatchObject({
			method: "POST",
			credentials: "include",
		});
	});
});
