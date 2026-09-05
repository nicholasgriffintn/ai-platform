import { describe, expect, it } from "vitest";

import { chatRetrySnapshotSchema } from "./chat-retries";
import { chatRunSchema } from "./chat-runs";

const retry = {
  protocolVersion: 1,
  step: 3,
  attempt: 2,
  maxAttempts: 2,
  runRetry: 1,
  maxRunRetries: 2,
  phase: "waiting",
  classification: "rate_limited",
  reason: "The model provider is rate limited.",
  scheduledAt: "2026-09-05T12:00:00.000Z",
  retryAt: "2026-09-05T12:00:02.000Z",
};

describe("chat retry contracts", () => {
  it("keeps model-call and run-wide attempt accounting distinct", () => {
    expect(chatRetrySnapshotSchema.parse(retry)).toMatchObject({
      attempt: 2,
      maxAttempts: 2,
      runRetry: 1,
      maxRunRetries: 2,
    });
  });

  it("keeps retry state optional for older clients and runs", () => {
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
        createdAt: "2026-09-05T12:00:00.000Z",
        updatedAt: "2026-09-05T12:00:00.000Z",
        startedAt: "2026-09-05T12:00:00.000Z",
        completedAt: null,
        terminalReason: null,
        lastMessageId: null,
      }).retry,
    ).toBeUndefined();
  });
});
