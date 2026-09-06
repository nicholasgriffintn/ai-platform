import { describe, expect, it, vi } from "vitest";

const recordMetric = vi.hoisted(() => vi.fn());

vi.mock("~/lib/monitoring", () => ({
  Monitoring: { getInstance: () => ({ recordMetric }) },
}));

import { recordChatRunOperationalMetric } from "../operational-metrics";

describe("recordChatRunOperationalMetric", () => {
  it("emits identifiers and classifications without prompts or tool arguments", () => {
    recordChatRunOperationalMetric({} as never, {
      signal: "uncertain_tool_outcome",
      runId: "run-1",
      attempt: 2,
      provider: "Example",
      operation: "create_item",
      outcome: "unknown",
    });

    expect(recordMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "chat_run_uncertain_tool_outcome",
        status: "error",
        metadata: {
          runId: "run-1",
          attempt: 2,
          provider: "Example",
          operation: "create_item",
          outcome: "unknown",
        },
      }),
    );
    expect(JSON.stringify(recordMetric.mock.calls[0])).not.toContain("prompt");
    expect(JSON.stringify(recordMetric.mock.calls[0])).not.toContain("arguments");
  });
});
