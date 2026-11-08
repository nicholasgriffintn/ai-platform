import type { ChatRun, ChatRunCommandReceipt } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { describe, expect, it, vi } from "vitest";

import type { AgentLoopExecutionResult } from "~/modules/responses/application/engine/agent/agent-loop";

import { ChatRunLifecycle } from "../lifecycle";

const runningRun: ChatRun = {
  protocolVersion: 1,
  id: "run-1",
  conversationId: "conversation-1",
  projectId: null,
  projectTaskId: null,
  initiatorUserId: 7,
  trigger: "user",
  status: "running",
  attempt: 1,
  createdAt: "2026-09-05T12:00:00.000Z",
  updatedAt: "2026-09-05T12:00:00.000Z",
  startedAt: "2026-09-05T12:00:00.000Z",
  completedAt: null,
  terminalReason: null,
  lastMessageId: null,
};

function receipt(): ChatRunCommandReceipt {
  return {
    protocolVersion: 1,
    commandId: "command-1",
    run: { ...runningRun },
    kind: "turn",
    acceptedAt: "2026-09-05T12:00:00.000Z",
    duplicate: false,
  };
}

function result(overrides: Partial<AgentLoopExecutionResult> = {}): AgentLoopExecutionResult {
  return {
    response: { response: "Done" },
    finalMessage: { id: "message-1", role: "assistant", content: "Done" },
    toolResponses: [],
    memoryMessages: [],
    guardrailsPassed: true,
    guardrailViolations: [],
    ...overrides,
  };
}

function createLifecycle() {
  const transition = vi.fn(async (params: { status: ChatRun["status"] }) => ({
    ...runningRun,
    status: params.status,
  }));
  const repository = {
    transition,
    getById: vi.fn().mockResolvedValue(runningRun),
    updateContext: vi.fn(),
    updateRetry: vi.fn(),
    updateProvenance: vi.fn(),
    checkpointPartialContent: vi.fn(),
  };
  const commandReceipt = receipt();

  return {
    commandReceipt,
    lifecycle: new ChatRunLifecycle(repository, commandReceipt),
    transition,
  };
}

describe("ChatRunLifecycle", () => {
  it("records waiting and terminal outcomes with the produced message identity", async () => {
    const waiting = createLifecycle();

    await waiting.lifecycle.complete(
      result({
        response: { status: "pending" },
        pendingInteractionKind: "question",
        finalMessage: undefined,
        toolResponses: [
          {
            id: "question-1",
            role: "tool",
            name: "ask_user",
            content: "Question",
          },
        ],
      }),
    );

    expect(waiting.transition).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "awaiting_input",
        lastMessageId: "question-1",
      }),
    );

    const completed = createLifecycle();

    await completed.lifecycle.complete(result());

    expect(completed.transition).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "succeeded",
        lastMessageId: "message-1",
      }),
    );
    expect(completed.commandReceipt.run.status).toBe("succeeded");
  });

  it("distinguishes ownership interruption from an ordinary failure", async () => {
    const interrupted = createLifecycle();
    const leaseError = new AssistantError("Lease lost", ErrorType.CONFLICT_ERROR, 409, {
      reason: "lease_ownership_lost",
    });

    await interrupted.lifecycle.fail(leaseError);

    expect(interrupted.transition).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "interrupted",
        terminalReason: "Lease lost",
      }),
    );

    const failed = createLifecycle();

    await failed.lifecycle.fail(new Error("Provider unavailable"));

    expect(failed.transition).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        terminalReason: "Provider unavailable",
      }),
    );
  });

  it("rejects a stale completion that cannot replace authoritative state", async () => {
    const { lifecycle, transition } = createLifecycle();

    transition.mockResolvedValueOnce(null);

    await expect(lifecycle.complete(result())).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});
