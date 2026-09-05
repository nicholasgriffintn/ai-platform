import type { ChatRun } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { handleCancelChatRun } from "../cancel";

const run: ChatRun = {
  protocolVersion: 1,
  id: "run-1",
  conversationId: "conversation-1",
  projectId: null,
  projectTaskId: null,
  initiatorUserId: 7,
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
    repositories: {
      conversationRuns: {
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
    },
  } as unknown as ServiceContext;
}

describe("handleCancelChatRun", () => {
  it("acknowledges cancellation separately from owner-confirmed interruption", async () => {
    const context = createContext();

    await expect(
      handleCancelChatRun(context, run.id, { command_id: "cancel-1", expected_attempt: 1 }),
    ).resolves.toMatchObject({
      run: { kind: "cancel", run: { id: run.id, status: "cancelling" } },
    });
  });

  it("rejects a stale attempt before recording a cancellation command", async () => {
    const context = createContext({ ...run, attempt: 2 });

    await expect(
      handleCancelChatRun(context, run.id, { command_id: "cancel-late", expected_attempt: 1 }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(context.repositories.conversationRuns.acceptCancellation).not.toHaveBeenCalled();
  });
});
