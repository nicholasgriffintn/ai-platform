import { describe, expect, it, vi } from "vitest";

import { parseSseBuffer } from "../sse";

describe("parseSseBuffer", () => {
	it("parses complete SSE data blocks", () => {
		const onEvent = vi.fn();
		const remaining = parseSseBuffer<{ type: string }>(
			`data: {"type":"run_started"}\n\n` +
				`data: {"type":"run_completed"}\n\n` +
				`data: [DONE]\n\n`,
			{
				onEvent,
			},
		);

		expect(remaining).toBe("");
		expect(onEvent).toHaveBeenCalledTimes(2);
		expect(onEvent.mock.calls[0]?.[0]).toEqual({ type: "run_started" });
		expect(onEvent.mock.calls[1]?.[0]).toEqual({ type: "run_completed" });
	});

	it("returns incomplete trailing buffers for the next parse cycle", () => {
		const onEvent = vi.fn();
		const remaining = parseSseBuffer<{ type: string }>(
			`data: {"type":"run_started"}\n\n` + `data: {"type":"run`,
			{
				onEvent,
			},
		);

		expect(onEvent).toHaveBeenCalledTimes(1);
		expect(remaining).toBe(`data: {"type":"run`);
	});

	it("supports multiline data payloads", () => {
		const onEvent = vi.fn();
		parseSseBuffer<{ message: string }>(
			`data: {"message":"line 1\\n` + `line 2"}\n\n`,
			{
				onEvent,
			},
		);

		expect(onEvent).toHaveBeenCalledWith({
			message: "line 1\nline 2",
		});
	});
});
