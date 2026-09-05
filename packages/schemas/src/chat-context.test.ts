import { describe, expect, it } from "vitest";

import { chatCompletionMessageSchema } from "./chat-completions";
import { chatContextSnapshotSchema } from "./chat-context";
import { chatRunSchema } from "./chat-runs";

const snapshot = {
  protocolVersion: 1,
  runId: "run-1",
  conversationId: "conversation-1",
  attempt: 1,
  step: 2,
  model: "model-1",
  generatedAt: "2026-09-05T10:00:00.000Z",
  usage: {
    inputTokens: 4200,
    contextWindow: 32000,
    source: "estimated",
  },
  messages: { included: 8, omitted: 2 },
  sources: [
    {
      id: "source-1",
      name: "Requirements.pdf",
      status: "included",
      retrievalPath: "/sources/source-1/content",
      messageId: "message-1",
    },
  ],
  skills: [{ id: "research", name: "Research", state: "loaded" }],
  summary: {
    messageId: "snapshot-1",
    status: "included",
    text: "The user requires British English.",
    representedMessageCount: 12,
    candidateMessageCount: 12,
    fallback: false,
  },
  omissions: [
    {
      id: "tool-result:message-2",
      kind: "tool_result",
      reason: "bounded",
      count: 1,
      messageId: "message-2",
      retrievalPath: "/chat/messages/message-2",
    },
  ],
};

describe("chat context contracts", () => {
  it("distinguishes estimates from provider-reported usage", () => {
    expect(chatContextSnapshotSchema.parse(snapshot).usage.source).toBe("estimated");
    expect(
      chatContextSnapshotSchema.parse({
        ...snapshot,
        usage: { ...snapshot.usage, source: "reported" },
      }).usage.source,
    ).toBe("reported");
  });

  it("rejects context metadata without a concrete usage source", () => {
    expect(
      chatContextSnapshotSchema.safeParse({
        ...snapshot,
        usage: { inputTokens: 4200, contextWindow: 32000 },
      }).success,
    ).toBe(false);
  });

  it("keeps context optional on older run payloads", () => {
    expect(
      chatRunSchema.parse({
        protocolVersion: 1,
        id: "run-1",
        conversationId: "conversation-1",
        projectId: null,
        projectTaskId: null,
        initiatorUserId: 1,
        status: "running",
        attempt: 1,
        createdAt: "2026-09-05T10:00:00.000Z",
        updatedAt: "2026-09-05T10:00:00.000Z",
        startedAt: "2026-09-05T10:00:00.000Z",
        completedAt: null,
        terminalReason: null,
        lastMessageId: null,
      }).context,
    ).toBeUndefined();
  });

  it("preserves a durable source id on attached message content", () => {
    const message = chatCompletionMessageSchema.parse({
      role: "user",
      content: [
        {
          type: "markdown_document",
          source_id: "source-1",
          markdown_document: { markdown: "# Brief", name: "Brief" },
        },
      ],
    });

    expect(Array.isArray(message.content) ? message.content[0]?.source_id : undefined).toBe(
      "source-1",
    );
  });
});
