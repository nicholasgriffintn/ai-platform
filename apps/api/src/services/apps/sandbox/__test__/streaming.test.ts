import { describe, expect, it } from "vitest";

import {
	createCoordinatorEventSseStream,
	isTerminalSandboxEventType,
	toSseChunk,
	toSseDoneChunk,
	toSsePingChunk,
} from "../streaming";

class MockSocket {
	private readonly listeners: Record<string, Array<(event?: any) => void>> = {};

	public addEventListener(type: string, listener: (event?: any) => void): void {
		this.listeners[type] ??= [];
		this.listeners[type]!.push(listener);
	}

	public removeEventListener(
		type: string,
		listener: (event?: any) => void,
	): void {
		const entries = this.listeners[type];
		if (!entries) {
			return;
		}
		this.listeners[type] = entries.filter((entry) => entry !== listener);
	}

	public close(): void {
		this.emit("close");
	}

	public emit(type: string, payload?: any): void {
		for (const listener of this.listeners[type] ?? []) {
			listener(payload);
		}
	}
}

describe("sandbox streaming helpers", () => {
	it("detects terminal event types", () => {
		expect(isTerminalSandboxEventType("run_completed")).toBe(true);
		expect(isTerminalSandboxEventType("run_failed")).toBe(true);
		expect(isTerminalSandboxEventType("run_cancelled")).toBe(true);
		expect(isTerminalSandboxEventType("run_started")).toBe(false);
	});

	it("encodes SSE chunks", () => {
		const chunk = new TextDecoder().decode(
			toSseChunk({ type: "run_started", runId: "run-1" }),
		);
		expect(chunk).toContain("data: ");
		expect(chunk).toContain('"runId":"run-1"');
		expect(chunk.endsWith("\n\n")).toBe(true);
		expect(new TextDecoder().decode(toSsePingChunk())).toBe(": ping\n\n");
		expect(new TextDecoder().decode(toSseDoneChunk())).toBe("data: [DONE]\n\n");
	});

	it("prefers websocket event streaming before polling", async () => {
		const socket = new MockSocket();
		const listEvents = async () => [];

		const stream = createCoordinatorEventSseStream({
			openSocket: async () => socket as unknown as WebSocket,
			listEvents,
		});

		queueMicrotask(() => {
			socket.emit("message", {
				data: JSON.stringify({
					index: 1,
					event: { type: "run_started", runId: "run-1" },
				}),
			});
			socket.emit("message", {
				data: JSON.stringify({
					index: 2,
					event: { type: "run_completed", runId: "run-1" },
				}),
			});
		});

		const output = await new Response(stream).text();
		expect(output).toContain("run_started");
		expect(output).toContain("run_completed");
		expect(output).toContain("[DONE]");
	});

	it("falls back to polling when websocket is unavailable", async () => {
		const listEvents = async (after: number) =>
			after === 0
				? [
						{
							index: 1,
							event: { type: "run_failed", runId: "run-1", error: "boom" },
						},
					]
				: [];

		const stream = createCoordinatorEventSseStream({
			openSocket: async () => null,
			listEvents,
		});

		const output = await new Response(stream).text();
		expect(output).toContain("run_failed");
		expect(output).toContain("[DONE]");
	});
});
