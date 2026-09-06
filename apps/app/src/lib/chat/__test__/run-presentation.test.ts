import type { ChatRun, ChatRunStatus } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { getChatRunLoadingMessage, getChatRunPresentation } from "../run-presentation";

function run(status: ChatRunStatus): ChatRun {
  return {
    protocolVersion: 1,
    id: "run-1",
    conversationId: "conversation-1",
    projectId: null,
    projectTaskId: null,
    initiatorUserId: 7,
    status,
    attempt: 1,
    createdAt: "2026-09-05T12:00:00.000Z",
    updatedAt: "2026-09-05T12:00:01.000Z",
    startedAt: "2026-09-05T12:00:01.000Z",
    completedAt: null,
    terminalReason: status === "failed" ? "Provider unavailable" : null,
    lastMessageId: null,
  };
}

describe("getChatRunPresentation", () => {
  it("shows a scheduled model retry without pretending the run attempt changed", () => {
    expect(
      getChatRunPresentation({
        ...run("running"),
        retry: {
          protocolVersion: 1,
          step: 2,
          attempt: 2,
          maxAttempts: 2,
          runRetry: 1,
          maxRunRetries: 2,
          phase: "waiting",
          classification: "network",
          reason: "The model provider connection failed temporarily.",
          scheduledAt: "2026-09-05T12:00:00.000Z",
          retryAt: "2026-09-05T12:00:01.000Z",
        },
      }),
    ).toMatchObject({
      label: "Retry scheduled",
      detail:
        "Attempt 2 of 2 · run retry 1 of 2 · The model provider connection failed temporarily.",
      tone: "attention",
    });
  });

  it("keeps waiting, cancellation, failure, and interruption visibly distinct", () => {
    expect(getChatRunPresentation(run("awaiting_input"))).toMatchObject({
      label: "Answer needed",
      tone: "attention",
    });
    expect(getChatRunPresentation(run("awaiting_approval"))).toMatchObject({
      label: "Approval needed",
      tone: "attention",
    });
    expect(getChatRunPresentation(run("cancelling"))).toMatchObject({
      label: "Stop requested",
      tone: "attention",
    });
    expect(getChatRunPresentation(run("cancelled"))).toMatchObject({
      label: "Task cancelled",
      tone: "neutral",
    });
    expect(getChatRunPresentation(run("failed"))).toMatchObject({
      label: "Task failed",
      detail: "Provider unavailable",
      tone: "danger",
    });
    expect(getChatRunPresentation(run("interrupted"))).toMatchObject({
      label: "Task interrupted",
      tone: "danger",
    });
  });
});

describe("getChatRunLoadingMessage", () => {
  it("distinguishes accepted, waiting, cancelling and running activity", () => {
    expect(getChatRunLoadingMessage("accepted")).toBe("Task accepted...");
    expect(getChatRunLoadingMessage("awaiting_approval")).toBe("Waiting for approval...");
    expect(getChatRunLoadingMessage("awaiting_input")).toBe("Waiting for your answer...");
    expect(getChatRunLoadingMessage("cancelling")).toBe("Stopping task...");
    expect(getChatRunLoadingMessage("running")).toBe("Task running...");
  });
});
