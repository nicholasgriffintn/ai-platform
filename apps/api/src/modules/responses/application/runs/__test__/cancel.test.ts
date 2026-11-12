import type { ChatRun } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ComposioConnectorSessionRepository } from "~/modules/connectors/infrastructure/ComposioConnectorSessionRepository";
import { ConnectorOperationApprovalRepository } from "~/modules/connectors/infrastructure/ConnectorOperationApprovalRepository";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { DelegationRepository } from "~/modules/delegations/infrastructure/DelegationRepository";

import { handleCancelChatRun } from "../cancel";

const metrics = vi.hoisted(() => ({
  recordTurnCancellationRequested: vi.fn(),
}));
const coordinator = vi.hoisted(() => ({ signalRunEffects: vi.fn(async () => true) }));

vi.mock("~/modules/responses/application/engine/streaming/continuity-telemetry", () => metrics);
vi.mock("~/modules/conversations/infrastructure/coordinator/client", () => coordinator);

const run: ChatRun = {
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
  updatedAt: "2026-09-05T12:00:01.000Z",
  startedAt: "2026-09-05T12:00:01.000Z",
  completedAt: null,
  terminalReason: null,
  lastMessageId: null,
};

function createContext(currentRun: ChatRun = run) {
  return {
    requireUser: vi.fn().mockReturnValue({ id: 7, plan_id: "pro" }),
    ensureDatabase: vi.fn(),
    repositories: fakeRepositories([
      [
        ConversationRunRepository,
        {
          getById: vi.fn().mockResolvedValue(currentRun),
          acceptCancellation: vi.fn().mockResolvedValue({
            protocolVersion: 1,
            commandId: "cancel-1",
            kind: "cancel",
            acceptedAt: "2026-09-05T12:00:02.000Z",
            duplicate: false,
            run: { ...currentRun, status: "cancelling" },
          }),
        },
      ],
      [
        DelegationRepository,
        {
          listByParentRunId: vi.fn().mockResolvedValue([]),
        },
      ],
      [
        ConnectorOperationApprovalRepository,
        {
          deleteUnconsumedForRun: vi.fn().mockResolvedValue(undefined),
        },
      ],
      [
        ComposioConnectorSessionRepository,
        {
          markRunCleanupPending: vi.fn().mockResolvedValue(undefined),
        },
      ],
    ]),
  } as unknown as ServiceContext;
}

describe("handleCancelChatRun", () => {
  beforeEach(() => vi.clearAllMocks());
  it("rejects a stale attempt before recording a cancellation command", async () => {
    const context = createContext({ ...run, attempt: 2 });

    await expect(
      handleCancelChatRun(context, run.id, {
        command_id: "cancel-late",
        expected_attempt: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(
      context.repositories.get(ConversationRunRepository).acceptCancellation,
    ).not.toHaveBeenCalled();
  });
});
