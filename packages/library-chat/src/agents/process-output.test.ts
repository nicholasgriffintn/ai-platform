import { describe, expect, it } from "vitest";

import { parseAgentProcessOutput } from "./process-output.js";

describe("parseAgentProcessOutput", () => {
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

  it("keeps unknown output visible without failing the stream", () => {
    expect(parseAgentProcessOutput("run-1", "unexpected output")).toEqual({
      type: "text",
      runId: "run-1",
      delta: "unexpected output\n",
    });
  });
});
