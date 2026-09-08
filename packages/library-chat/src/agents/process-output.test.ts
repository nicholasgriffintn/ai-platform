import { describe, expect, it } from "vitest";

import { parseAgentProcessOutput } from "./process-output.js";

describe("parseAgentProcessOutput", () => {
  it("reads the documented Grok headless result", () => {
    expect(
      parseAgentProcessOutput(
        "run-1",
        JSON.stringify({
          text: "Reply",
          stopReason: "end_turn",
          sessionId: "session-1",
          requestId: "request-1",
        }),
      ),
    ).toEqual({ type: "text", runId: "run-1", delta: "Reply" });
  });
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
  it("normalises nested agent text from vendor streams", () => {
    expect(
      parseAgentProcessOutput(
        "run-1",
        JSON.stringify({
          method: "session/update",
          params: { update: { sessionUpdate: "agent_message_chunk", content: { text: "hello" } } },
        }),
      ),
    ).toEqual({ type: "text", runId: "run-1", delta: "hello" });
  });

  it("does not present diagnostics as an assistant reply", () => {
    expect(parseAgentProcessOutput("run-1", "unexpected output")).toEqual({
      type: "progress",
      runId: "run-1",
      state: "generating",
    });
  });
});
