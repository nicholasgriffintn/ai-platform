import { describe, expect, it } from "vitest";

import { parseAgentProcessOutput } from "./process-output.js";

describe("parseAgentProcessOutput", () => {
  it("keeps tool output and result summaries out of assistant text", () => {
    for (const event of [
      {
        type: "item.completed",
        item: { type: "command_execution", text: "private command output" },
      },
      { type: "result", result: "Already emitted assistant text" },
      { type: "assistant", message: { content: [{ type: "tool_use", text: "tool arguments" }] } },
    ]) {
      expect(parseAgentProcessOutput("run-1", JSON.stringify(event)).type).toBe("progress");
    }

    expect(
      parseAgentProcessOutput(
        "run-1",
        JSON.stringify({
          type: "assistant",
          message: { content: [{ type: "text", text: "Real reply" }] },
        }),
      ),
    ).toEqual({ type: "text", runId: "run-1", delta: "Real reply" });
    expect(
      parseAgentProcessOutput(
        "run-1",
        JSON.stringify({
          type: "result",
          is_error: true,
          result: "Authentication expired",
        }),
      ),
    ).toMatchObject({ type: "failed", message: "Authentication expired" });
  });
});
