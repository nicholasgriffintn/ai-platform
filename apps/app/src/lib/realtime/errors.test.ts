import { describe, expect, it } from "vitest";

import { formatRealtimeWebSocketCloseError } from "./errors";

function closeEvent(init: Pick<CloseEvent, "code" | "reason">): CloseEvent {
	return init as CloseEvent;
}

describe("realtime error helpers", () => {
	it("formats WebSocket close details when available", () => {
		expect(
			formatRealtimeWebSocketCloseError(
				"Mistral realtime transcription",
				closeEvent({ code: 1006, reason: "provider closed" }),
			),
		).toBe("Mistral realtime transcription disconnected (code 1006, provider closed)");
	});

	it("omits empty WebSocket close details", () => {
		expect(
			formatRealtimeWebSocketCloseError("Gemini Live", closeEvent({ code: 0, reason: "" })),
		).toBe("Gemini Live disconnected");
	});
});
