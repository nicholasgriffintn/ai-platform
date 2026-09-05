import type {
  ChatRetrySnapshot,
  ChatRun,
  ChatRunCommandReceipt,
} from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { createChatRetryStatePublisher } from "../retry-state";

const run: ChatRun = {
  protocolVersion: 1,
  id: "run-1",
  conversationId: "conversation-1",
  projectId: null,
  projectTaskId: null,
  initiatorUserId: 42,
  status: "running",
  attempt: 1,
  createdAt: "2026-09-05T12:00:00.000Z",
  updatedAt: "2026-09-05T12:00:00.000Z",
  startedAt: "2026-09-05T12:00:00.000Z",
  completedAt: null,
  terminalReason: null,
  lastMessageId: null,
  context: null,
  retry: null,
};

const retry: ChatRetrySnapshot = {
  protocolVersion: 1,
  step: 2,
  attempt: 2,
  maxAttempts: 2,
  runRetry: 1,
  maxRunRetries: 2,
  phase: "waiting",
  classification: "provider_unavailable",
  reason: "The model provider is temporarily unavailable.",
  scheduledAt: "2026-09-05T12:00:00.000Z",
  retryAt: "2026-09-05T12:00:01.000Z",
};

describe("createChatRetryStatePublisher", () => {
  it("persists before emitting retry state and the refreshed receipt", async () => {
    const updatedRun = { ...run, retry };
    const receipt: ChatRunCommandReceipt = {
      protocolVersion: 1,
      commandId: "command-1",
      run,
      kind: "turn",
      acceptedAt: run.createdAt,
      duplicate: false,
    };
    const recordRetry = vi.fn(async () => {
      receipt.run = updatedRun;

      return updatedRun;
    });
    const writeEvent = vi.fn(async () => undefined);
    const publish = createChatRetryStatePublisher({
      sink: { writeEvent },
      runLifecycle: { receipt, recordRetry },
    });

    await publish(retry);

    expect(recordRetry).toHaveBeenCalledWith(retry);
    expect(recordRetry.mock.invocationCallOrder[0]).toBeLessThan(
      writeEvent.mock.invocationCallOrder[0],
    );
    expect(writeEvent).toHaveBeenNthCalledWith(1, "state", { state: "retry", retry });
    expect(writeEvent).toHaveBeenNthCalledWith(2, "state", { state: "run", receipt });
  });

  it("still emits stream state for an unstored run", async () => {
    const writeEvent = vi.fn(async () => undefined);
    const publish = createChatRetryStatePublisher({ sink: { writeEvent } });

    await publish(retry);

    expect(writeEvent).toHaveBeenCalledOnce();
    expect(writeEvent).toHaveBeenCalledWith("state", { state: "retry", retry });
  });
});
