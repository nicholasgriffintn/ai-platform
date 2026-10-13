import { describe, expect, it } from "vitest";

import { toProviderConversation } from "../model-port";

describe("toProviderConversation", () => {
  it("lifts system messages into the system prompt and keeps tool turns intact", () => {
    const result = toProviderConversation([
      { role: "system", content: "You are Pi." },
      { role: "developer", content: "Prefer small edits." },
      { role: "user", content: "Fix the build" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "run_command", arguments: { command: "pnpm build" } },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_1", content: "exit_code=0" },
    ]);

    expect(result.systemPrompt).toBe("You are Pi.\n\nPrefer small edits.");
    expect(result.messages).toEqual([
      { role: "user", content: "Fix the build" },
      {
        role: "assistant",
        content: "",
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "run_command", arguments: '{"command":"pnpm build"}' },
          },
        ],
      },
      { role: "tool", content: "exit_code=0", tool_call_id: "call_1" },
    ]);
  });
});
