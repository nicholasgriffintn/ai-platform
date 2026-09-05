import type { ChatRun } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { handleGetChatRun, handleGetChatRunSnapshot } from "../status";

const personalRun: ChatRun = {
  protocolVersion: 1,
  id: "run-1",
  conversationId: "conversation-1",
  projectId: null,
  projectTaskId: null,
  initiatorUserId: 7,
  status: "running",
  attempt: 1,
  createdAt: "2026-09-05T12:00:00.000Z",
  updatedAt: "2026-09-05T12:00:00.000Z",
  startedAt: "2026-09-05T12:00:00.000Z",
  completedAt: null,
  terminalReason: null,
  lastMessageId: null,
};

function createContext(run: ChatRun | null, userId = 7) {
  return {
    requireUser: vi.fn().mockReturnValue({ id: userId, plan_id: "pro" }),
    ensureDatabase: vi.fn(),
    repositories: {
      conversationRuns: {
        getById: vi.fn().mockResolvedValue(run),
        getEventCursor: vi.fn().mockResolvedValue(4),
      },
      messages: {
        getRunMessages: vi.fn().mockResolvedValue([
          {
            id: "assistant-1",
            conversation_id: "conversation-1",
            run_id: "run-1",
            role: "assistant",
            content: "Partial answer",
          },
        ]),
      },
      connectorOperationApprovals: {},
      usageEvents: {
        summariseChatRuns: vi.fn().mockResolvedValue([]),
      },
      usageReservations: {
        listReservations: vi.fn().mockResolvedValue([]),
      },
      workspaces: {
        getProject: vi.fn().mockResolvedValue({ id: "project-1", workspace_id: "workspace-1" }),
        getWorkspace: vi.fn().mockResolvedValue({ id: "workspace-1" }),
        getMembership: vi.fn().mockResolvedValue({ role: "member" }),
      },
    },
  } as unknown as ServiceContext;
}

describe("handleGetChatRun", () => {
  it("returns a personal run only to its initiating user", async () => {
    await expect(handleGetChatRun(createContext(personalRun), personalRun.id)).resolves.toEqual({
      run: expect.objectContaining({
        ...personalRun,
        usage: expect.objectContaining({
          measurement: "unknown",
          consumption: expect.objectContaining({ costMicros: null, creditMicros: null }),
        }),
      }),
      messages: [
        expect.objectContaining({
          id: "assistant-1",
          content: "Partial answer",
          run_id: "run-1",
        }),
      ],
    });
    await expect(
      handleGetChatRun(createContext(personalRun, 8), personalRun.id),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("uses current project membership rather than the initiating user", async () => {
    const projectRun = { ...personalRun, projectId: "project-1" };
    const memberContext = createContext(projectRun, 8);

    await expect(handleGetChatRun(memberContext, projectRun.id)).resolves.toEqual({
      run: expect.objectContaining({ ...projectRun, usage: expect.any(Object) }),
      messages: [expect.objectContaining({ id: "assistant-1" })],
    });
    expect(memberContext.repositories.workspaces.getMembership).toHaveBeenCalledWith(
      "workspace-1",
      8,
    );

    const revokedContext = createContext(projectRun, 8);

    vi.mocked(revokedContext.repositories.workspaces.getMembership).mockResolvedValue(null);

    await expect(handleGetChatRun(revokedContext, projectRun.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("anchors a snapshot cursor before reading authoritative state and messages", async () => {
    const context = createContext(personalRun);

    await expect(handleGetChatRunSnapshot(context, personalRun.id)).resolves.toMatchObject({
      protocolVersion: 1,
      cursor: 4,
      run: personalRun,
      messages: [expect.objectContaining({ id: "assistant-1" })],
    });
    expect(context.repositories.conversationRuns.getById).toHaveBeenCalledOnce();
    expect(
      vi.mocked(context.repositories.conversationRuns.getEventCursor).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(context.repositories.conversationRuns.getById).mock.invocationCallOrder[0] ?? 0,
    );
  });
});
