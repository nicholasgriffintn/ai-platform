import type { AgentMessage } from "@ngriffin_uk/polychat-library-agent-core";
import { describe, expect, it } from "vitest";

import { applyReportedContextUsage, fitMessagesToContextBudget } from "../context-budget";

function plan(messages: AgentMessage[], contextWindow = 32000) {
  return fitMessagesToContextBudget({
    messages,
    contextWindow,
    systemPrompt: "System rules",
    maxOutputTokens: 1000,
    maxToolResultCharacters: 120,
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
  it("bounds a large tool result before the next model call and retains its stored reference", () => {
    const content = `start ${"verbose ".repeat(100)} final evidence`;
    const messages = [
      { role: "user", content: "Investigate this", id: "user-1" },
      {
        role: "assistant",
        content: "",
        tool_calls: [{ id: "call-1", function: { name: "search", arguments: "{}" } }],
        id: "assistant-1",
      },
      {
        role: "tool",
        name: "search",
        content,
        tool_call_id: "call-1",
        id: "tool-1",
      },
    ] satisfies Array<AgentMessage & { id: string }>;

    const result = plan(messages);
    const toolResult = result.messages.find((message) => message.role === "tool");

    expect(toolResult?.content).toContain("Tool result shortened");
    expect(toolResult?.content).toContain("final evidence");
    expect(messages[2]?.content).toBe(content);
    expect(result.snapshot.omissions).toContainEqual(
      expect.objectContaining({
        kind: "tool_result",
        reason: "bounded",
        messageId: "tool-1",
        retrievalPath: "/chat/messages/tool-1",
      }),
    );
  });

  it("keeps the latest user constraint when a smaller model window omits older steps", () => {
    const messages: Array<AgentMessage & { id: string }> = [
      { role: "user", content: "Original task", id: "user-1" },
      { role: "assistant", content: "old ".repeat(1000), id: "assistant-1" },
      { role: "user", content: "Use British English in every answer", id: "user-2" },
      { role: "assistant", content: "recent ".repeat(400), id: "assistant-2" },
    ];

    const result = plan(messages, 1100);

    expect(result.messages).toContainEqual(
      expect.objectContaining({ id: "user-2", content: "Use British English in every answer" }),
    );
    expect(result.messages).not.toContainEqual(expect.objectContaining({ id: "assistant-1" }));
    expect(result.snapshot.messages.omitted).toBeGreaterThan(0);
    expect(result.snapshot.omissions).toContainEqual(
      expect.objectContaining({ kind: "history", reason: "context_window" }),
    );
  });

  it("reports attached sources, loaded skills and the active compaction summary", () => {
    const result = plan([
      {
        role: "assistant",
        content: "Conversation snapshot\n\nKeep the user constraint.",
        id: "snapshot-1",
        parts: [
          {
            type: "snapshot",
            summary: "Keep the user constraint.",
            coverage: {
              coveredMessageIds: ["old-1"],
              coveredMessageCount: 1,
              candidateMessageCount: 2,
              summaryInputCharacters: 120,
              strategy: "fallback_transcript",
            },
          },
        ],
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Read this" },
          {
            type: "document_url",
            document_url: {
              url: "https://app.example/sources/source-1/content",
              name: "Requirements.pdf",
              source_id: "source-1",
            },
          },
        ],
        id: "user-1",
      },
      {
        role: "tool",
        name: "load_skill",
        status: "success",
        content: "skill body",
        id: "skill-1",
        data: { skill: "research", provenance: { revision: 3 } },
      },
    ] as Array<AgentMessage & Record<string, unknown>>);

    expect(result.snapshot.sources).toEqual([
      expect.objectContaining({
        id: "source-1",
        name: "Requirements.pdf",
        status: "included",
        retrievalPath: "/sources/source-1/content",
      }),
    ]);
    expect(result.snapshot.skills).toEqual([
      { id: "research", name: "Research", state: "loaded", revision: 3 },
    ]);
    expect(result.snapshot.summary).toEqual(
      expect.objectContaining({
        messageId: "snapshot-1",
        status: "included",
        text: "Keep the user constraint.",
        representedMessageCount: 1,
        candidateMessageCount: 2,
        fallback: true,
      }),
    );
    expect(result.snapshot.provider).toBe("provider-1");
  });

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

  it("uses provider input telemetry only when it is present", () => {
    const estimated = plan([{ role: "user", content: "Hello" }]).snapshot;

    expect(applyReportedContextUsage(estimated, undefined).usage.source).toBe("estimated");
    expect(applyReportedContextUsage(estimated, 321).usage).toEqual({
      inputTokens: 321,
      contextWindow: 32000,
      source: "reported",
    });
  });
});
