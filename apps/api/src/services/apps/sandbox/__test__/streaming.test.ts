import { describe, expect, it } from "vitest";

import {
	isTerminalSandboxEventType,
	toSseChunk,
	toSseDoneChunk,
	toSsePingChunk,
} from "../streaming";

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
});
