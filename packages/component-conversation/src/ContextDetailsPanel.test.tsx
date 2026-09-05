import type { ChatContextSnapshot } from "@ngriffin_uk/polychat-schemas";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ContextDetailsPanel } from "./ContextDetailsPanel";

const runUsage = {
  protocolVersion: 1 as const,
  runId: "run-1",
  currentAttempt: 1,
  measurement: "estimated" as const,
  reservation: {
    creditMicros: 50_000,
    status: "held" as const,
    expiresAt: "2026-09-06T10:00:00.000Z",
    createdAt: "2026-09-05T10:00:00.000Z",
    updatedAt: null,
  },
  consumption: {
    status: "unknown" as const,
    eventCount: 0,
    costMicros: null,
    creditMicros: null,
    estimatedPriceEventCount: 0,
    bySource: [],
  },
  attempts: [],
  settlement: { status: "pending" as const, at: null },
};

const context: ChatContextSnapshot = {
  protocolVersion: 1,
  runId: "run-1",
  conversationId: "conversation-1",
  attempt: 1,
  step: 3,
  model: "model-1",
  provider: "provider-1",
  generatedAt: "2026-09-05T10:00:00.000Z",
  usage: { inputTokens: 4800, contextWindow: 32000, source: "estimated" },
  messages: { included: 9, omitted: 2 },
  sources: [
    {
      id: "source-1",
      name: "Requirements.pdf",
      status: "included",
      retrievalPath: "/sources/source-1/content",
      messageId: "message-1",
    },
  ],
  skills: [{ id: "research", name: "Research", state: "loaded", revision: 2 }],
  approvals: [
    {
      id: "approval-1",
      type: "approval",
      status: "approved",
      toolName: "publish",
      messageId: "message-2",
    },
  ],
  summary: {
    messageId: "summary-1",
    status: "included",
    text: "Keep the user's later constraint.",
    representedMessageCount: 10,
    candidateMessageCount: 12,
    fallback: false,
  },
  omissions: [
    {
      id: "tool-result:tool-1",
      kind: "tool_result",
      reason: "bounded",
      count: 1,
      messageId: "tool-1",
      retrievalPath: "/chat/messages/tool-1",
    },
  ],
};

describe("ContextDetailsPanel", () => {
  it("labels estimates and explains included, summarised and omitted context", () => {
    render(
      <ContextDetailsPanel
        context={context}
        usage={runUsage}
        resolveReferenceHref={(path) => `https://api.example${path}`}
      />,
    );

    expect(screen.getByText("4,800 estimated tokens")).toBeTruthy();
    expect(screen.getByText("Requirements.pdf")).toBeTruthy();
    expect(screen.getByText("Research · loaded · r2")).toBeTruthy();
    expect(screen.getByText("model-1 via provider-1")).toBeTruthy();
    expect(screen.getByText("publish · approved")).toBeTruthy();
    expect(screen.getByText(/12 candidate messages · included/)).toBeTruthy();
    expect(screen.getByText("Keep the user's later constraint.")).toBeTruthy();
    expect(screen.getByText("Tool result shortened")).toBeTruthy();
    expect(screen.getByText("Reserved estimate: 0.05 credits · not a charge")).toBeTruthy();
    expect(screen.getByText("Recorded consumption: unknown")).toBeTruthy();
    expect(screen.getByText("Settlement: pending")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Requirements.pdf" }).getAttribute("href")).toBe(
      "https://api.example/sources/source-1/content",
    );
  });
});
