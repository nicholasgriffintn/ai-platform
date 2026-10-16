import { CHAT_RUN_PROTOCOL_VERSION, type ChatRun } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

const mocks = vi.hoisted(() => ({
  finishUsageReservation: vi.fn(),
  scheduleComposioConnectorRunCleanup: vi.fn(),
  acquireThread: vi.fn(),
}));

vi.mock("@ngriffin_uk/polychat-ai-billing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-billing")>()),
  finishUsageReservation: mocks.finishUsageReservation,
}));

vi.mock("~/modules/connectors/application/composio-run", () => ({
  scheduleComposioConnectorRunCleanup: mocks.scheduleComposioConnectorRunCleanup,
}));

vi.mock("~/modules/conversations/infrastructure/coordinator/client", () => ({
  acquireThread: mocks.acquireThread,
}));

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ComposioConnectorSessionRepository } from "~/modules/connectors/infrastructure/ComposioConnectorSessionRepository";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import { UsageBalanceRepository } from "~/modules/usage/infrastructure/UsageBalanceRepository";
import { UsageReservationRepository } from "~/modules/usage/infrastructure/UsageReservationRepository";

import { recoverRedeliveredProjectTaskRun } from "../runner";

function run(status: ChatRun["status"]): ChatRun {
  return {
    protocolVersion: CHAT_RUN_PROTOCOL_VERSION,
    id: "run-1",
    conversationId: "conversation-1",
    projectId: "project-1",
    projectTaskId: "task-1",
    initiatorUserId: 7,
    trigger: "user",
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
    repositories: fakeRepositories([
      [
        ConversationRunRepository,
        {
          getById: vi.fn().mockResolvedValue(current),
          transition: vi.fn().mockResolvedValue(transitioned),
        },
      ],
      [
        MessageRepository,
        {
          getLatestPendingToolMessage: vi.fn().mockResolvedValue({
            id: "interaction-1",
            name: "ask_user",
            timestamp: Date.now(),
            data: { humanInTheLoop: { status: "pending" } },
          }),
          updateMessage: vi.fn(),
        },
      ],
      [UsageReservationRepository, {}],
      [UsageBalanceRepository, {}],
      [ComposioConnectorSessionRepository, {}],
    ]),
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
    expect(context.repositories.get(ConversationRunRepository).transition).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1", status: "interrupted" }),
    );
    expect(mocks.finishUsageReservation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: "chat_run", refId: "run-1", outcome: "released" }),
    );
    expect(mocks.scheduleComposioConnectorRunCleanup).toHaveBeenCalledWith(context, "run-1");
    expect(threadLease.release).toHaveBeenCalledOnce();
  });

  it.each(["awaiting_input", "awaiting_approval"] as const)(
    "rehydrates %s and preserves its replay resources",
    async (status) => {
      const current = run(status);
      const { context, executionLease } = setup(current);

      const recovered = await recoverRedeliveredProjectTaskRun({
        context,
        conversationId: current.conversationId,
        executionLease,
        run: current,
      });

      expect(recovered).toEqual(current);
      expect(context.repositories.get(ConversationRunRepository).transition).not.toHaveBeenCalled();
      expect(mocks.finishUsageReservation).toHaveBeenCalledOnce();
      expect(mocks.scheduleComposioConnectorRunCleanup).not.toHaveBeenCalled();
    },
  );

  it("marks an expired waiting interaction failed without resuming provider work", async () => {
    const current = run("awaiting_input");
    const failed: ChatRun = { ...current, status: "failed" };
    const { context, executionLease } = setup(current, failed);

    vi.mocked(
      context.repositories.get(MessageRepository).getLatestPendingToolMessage,
    ).mockResolvedValueOnce({
      id: "interaction-1",
      name: "ask_user",
      created_at: "2000-01-01T00:00:00.000Z",
      data: { humanInTheLoop: { status: "pending" } },
    });

    await expect(
      recoverRedeliveredProjectTaskRun({
        context,
        conversationId: current.conversationId,
        executionLease,
        run: current,
      }),
    ).resolves.toEqual(failed);
    expect(context.repositories.get(MessageRepository).updateMessage).toHaveBeenCalledWith(
      current.conversationId,
      "interaction-1",
      expect.objectContaining({
        status: "resolved",
        data: expect.objectContaining({
          humanInTheLoop: expect.objectContaining({
            status: "expired",
            requires_user_action: false,
          }),
        }),
      }),
    );
    expect(context.repositories.get(ConversationRunRepository).transition).toHaveBeenCalledWith(
      expect.objectContaining({ runId: current.id, attempt: current.attempt, status: "failed" }),
    );
  });
});
