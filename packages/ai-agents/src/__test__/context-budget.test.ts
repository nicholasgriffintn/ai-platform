import type { AgentMessage } from "@ngriffin_uk/polychat-library-agent-loop";
import { describe, expect, it } from "vitest";

import { fitMessagesToContextBudget } from "../context/context-budget.js";

function plan(messages: AgentMessage[], contextWindow = 32000) {
  return fitMessagesToContextBudget({
    messages,
    contextWindow,
    systemPrompt: "System rules",
    maxOutputTokens: 1000,
    runId: "run-1",
    conversationId: "conversation-1",
    attempt: 1,
    step: 2,
    model: "model-1",
    provider: "provider-1",
    generatedAt: "2026-09-05T10:00:00.000Z",
    skills: [{ id: "research", name: "Research" }],
  });
}

describe("mid-run context budgeting", () => {
  it("retains bounded approval references without copying tool arguments", () => {
    const result = plan([
      {
        role: "tool",
        name: "publish",
        content: "Approved",
        id: "approval-message-1",
        data: {
          secretArguments: { recipient: "private@example.test" },
          resolution: "approved",
          approval: { interactionId: "approval-1", toolName: "publish", status: "approved" },
          humanInTheLoop: {
            type: "approval",
            status: "resolved",
            interactionId: "approval-1",
            toolName: "publish",
            resolution: "approved",
          },
        },
      },
    ] as Array<AgentMessage & Record<string, unknown>>);

    expect(result.snapshot.approvals).toEqual([
      {
        id: "approval-1",
        type: "approval",
        status: "approved",
        toolName: "publish",
        messageId: "approval-message-1",
      },
    ]);
    expect(JSON.stringify(result.snapshot.approvals)).not.toContain("private@example.test");
  });
});
