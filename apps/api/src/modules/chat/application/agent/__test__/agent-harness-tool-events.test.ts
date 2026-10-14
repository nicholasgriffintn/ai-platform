import { describe, expect, it } from "vitest";

import type { MessagePart } from "~/types";

import { applyAgentHarnessToolEvent } from "../agent-harness-tool-events";

describe("applyAgentHarnessToolEvent", () => {
  it("records harness tool calls as message parts and live tool events", async () => {
    const events: string[] = [];
    const parts: MessagePart[] = [];
    const target = {
      sink: {
        write: async ({ type }: { type: string }) => {
          events.push(type);
        },
      },
      step: 1,
      parts,
    };

    await applyAgentHarnessToolEvent(
      {
        type: "polychat.agent_tool",
        phase: "started",
        toolCallId: "t1",
        toolName: "run_command",
        input: { command: "pnpm test" },
      },
      target,
    );
    await applyAgentHarnessToolEvent(
      {
        type: "polychat.agent_tool",
        phase: "finished",
        toolCallId: "t1",
        toolName: "run_command",
        error: "exit 1",
      },
      target,
    );

    expect(parts).toMatchObject([
      { type: "tool_use", name: "run_command", toolCallId: "t1", input: { command: "pnpm test" } },
      {
        type: "tool_result",
        name: "run_command",
        toolCallId: "t1",
        status: "error",
        content: "exit 1",
      },
    ]);
    expect(events).toContain("response.output_item.added");
    expect(events).toContain("response.output_item.done");
  });
});
