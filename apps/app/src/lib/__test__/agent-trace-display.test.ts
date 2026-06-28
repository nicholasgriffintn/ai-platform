import { describe, expect, it } from "vitest";

import {
	formatAgentTraceLatency,
	formatAgentTraceUsage,
	getAgentTraceTypeLabel,
} from "~/lib/agent-trace-display";

describe("agent trace display", () => {
	it("formats trace labels, usage, and latency behind the trace display seam", () => {
		expect(getAgentTraceTypeLabel("provider_error")).toBe("Provider error");
		expect(
			formatAgentTraceUsage({
				id: "trace-1",
				type: "model_call",
				label: "gpt",
				usage: { costUsd: 0.01234 },
			}),
		).toBe("$0.0123");
		expect(
			formatAgentTraceUsage({
				id: "trace-2",
				type: "model_call",
				label: "gpt",
				usage: { inputTokens: 100, outputTokens: 20 },
			}),
		).toBe("100 in / 20 out");
		expect(
			formatAgentTraceLatency({
				id: "trace-3",
				type: "tool_call",
				label: "tool",
				latencyMs: 1200,
			}),
		).toBe("1.2s");
	});
});
