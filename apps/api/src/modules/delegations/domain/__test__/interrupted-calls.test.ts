import { describe, expect, it } from "vitest";

import { findUnsettledToolCalls, settleInterruptedCall } from "../interrupted-calls";

describe("interrupted delegation tool calls", () => {
  it("finds stored calls that never received a result", () => {
    const rows = [
      {
        role: "assistant",
        tool_calls: JSON.stringify([
          { id: "call_read", type: "function", function: { name: "web_search", arguments: "{}" } },
          { id: "call_send", name: "send_email", arguments: { to: "a@example.com" } },
        ]),
      },
      { role: "tool", tool_call_id: "call_read", content: "results" },
    ];

    expect(findUnsettledToolCalls(rows)).toEqual([
      { id: "call_send", name: "send_email", arguments: { to: "a@example.com" } },
    ]);
  });

  it("only invites a repeat for calls that cannot change anything", () => {
    expect(settleInterruptedCall("web_search", "read").outcome).toBe("not_applied");

    for (const effect of ["draft", "write", "external_send", "spend", "destructive"] as const) {
      const settlement = settleInterruptedCall("send_email", effect);

      expect(settlement.outcome).toBe("unknown");
      expect(settlement.content).toContain("Check whether it did before repeating it");
    }
  });
});
