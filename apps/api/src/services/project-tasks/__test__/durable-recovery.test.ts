import { CHAT_RUN_PROTOCOL_VERSION, type ChatRun } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

const mocks = vi.hoisted(() => ({
  finishUsageReservation: vi.fn(),
  scheduleComposioConnectorRunCleanup: vi.fn(),
  acquireThread: vi.fn(),
}));

vi.mock("~/lib/usage/reservations", () => ({
  finishUsageReservation: mocks.finishUsageReservation,
}));

vi.mock("~/services/apps/connectors/composio-run", () => ({
  scheduleComposioConnectorRunCleanup: mocks.scheduleComposioConnectorRunCleanup,
}));

vi.mock("~/services/conversations/coordinator/client", () => ({
  acquireThread: mocks.acquireThread,
}));

import { recoverRedeliveredProjectTaskRun } from "../runner";

function run(status: ChatRun["status"]): ChatRun {
  return {
    protocolVersion: CHAT_RUN_PROTOCOL_VERSION,
    id: "run-1",
    conversationId: "conversation-1",
    projectId: "project-1",
    projectTaskId: "task-1",
    initiatorUserId: 7,
    status,
    attempt: 1,
    createdAt: "2026-09-05T12:00:00.000Z",
    updatedAt: "2026-09-05T12:00:00.000Z",
    startedAt: "2026-09-05T12:00:00.000Z",
    completedAt: null,
    terminalReason: null,
    lastMessageId: null,
  };
}

function setup(current: ChatRun, transitioned: ChatRun | null = null) {
  const threadLease = {
    assertOwned: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
  };
  const executionLease = {
    ownerToken: "owner-1",
    expiresAt: "2026-09-05T12:05:00.000Z",
    assertOwned: vi.fn().mockResolvedValue(undefined),
  };
  const context = {
    env: {},
    repositories: {
      conversationRuns: {
        getById: vi.fn().mockResolvedValue(current),
        transition: vi.fn().mockResolvedValue(transitioned),
      },
      messages: {
        getLatestPendingToolMessage: vi.fn().mockResolvedValue({
          id: "interaction-1",
          name: "ask_user",
          timestamp: Date.now(),
          data: { humanInTheLoop: { status: "pending" } },
        }),
        updateMessage: vi.fn(),
      },
      usageReservations: {},
      usageBalances: {},
      composioConnectorSessions: {},
    },
  } as unknown as ServiceContext;

  mocks.acquireThread.mockResolvedValue({ acquired: true, lease: threadLease });

  return { context, executionLease, threadLease };
}

describe("durable project-task run recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.finishUsageReservation.mockResolvedValue(null);
    mocks.scheduleComposioConnectorRunCleanup.mockResolvedValue(undefined);
  });

  it("classifies a lost mid-run owner as interrupted without replaying it", async () => {
    const current = run("running");
    const interrupted = {
      ...current,
      status: "interrupted" as const,
      terminalReason: "Owner ended",
    };
    const { context, executionLease, threadLease } = setup(current, interrupted);

    const recovered = await recoverRedeliveredProjectTaskRun({
      context,
      conversationId: current.conversationId,
      executionLease,
      run: current,
    });

    expect(recovered.status).toBe("interrupted");
    expect(context.repositories.conversationRuns.transition).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1", status: "interrupted" }),
    );
    expect(mocks.finishUsageReservation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "chat_run", refId: "run-1", outcome: "released" }),
    );
    expect(mocks.scheduleComposioConnectorRunCleanup).toHaveBeenCalledWith(context, "run-1");
    expect(threadLease.release).toHaveBeenCalledOnce();
  });

  it("rehydrates a persisted waiting interaction and preserves its replay resources", async () => {
    const current = run("awaiting_input");
    const { context, executionLease } = setup(current);

    const recovered = await recoverRedeliveredProjectTaskRun({
      context,
      conversationId: current.conversationId,
      executionLease,
      run: current,
    });

    expect(recovered).toEqual(current);
    expect(context.repositories.conversationRuns.transition).not.toHaveBeenCalled();
    expect(mocks.finishUsageReservation).toHaveBeenCalledOnce();
    expect(mocks.scheduleComposioConnectorRunCleanup).not.toHaveBeenCalled();
  });
});
