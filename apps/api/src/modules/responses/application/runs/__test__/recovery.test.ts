import type { ChatRun } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

const {
  mockGetActiveThreadOperation,
  mockPublishConversationChanged,
  mockPublishRunChanged,
  mockSalvageInterruptedReply,
} = vi.hoisted(() => ({
  mockGetActiveThreadOperation: vi.fn(),
  mockPublishConversationChanged: vi.fn(),
  mockPublishRunChanged: vi.fn(),
  mockSalvageInterruptedReply: vi.fn(),
}));

vi.mock("~/modules/conversations/infrastructure/coordinator/client", () => ({
  getActiveThreadOperation: mockGetActiveThreadOperation,
}));

vi.mock("~/modules/sync/application/conversation-events", () => ({
  publishConversationChanged: mockPublishConversationChanged,
  publishRunChanged: mockPublishRunChanged,
}));

vi.mock("../interrupted-reply", () => ({
  salvageInterruptedReply: mockSalvageInterruptedReply,
}));

import { reconcileInactiveChatRun } from "../recovery";

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
  createdAt: "2026-09-16T12:00:00.000Z",
  updatedAt: "2026-09-16T12:00:01.000Z",
  startedAt: "2026-09-16T12:00:01.000Z",
  completedAt: null,
  terminalReason: null,
  lastMessageId: null,
};

function createContext(transitionedRun: ChatRun, partial: string | null = null): ServiceContext {
  return {
    env: { DB: {} },
    waitUntil: vi.fn(),
    repositories: {
      conversationRuns: {
        transition: vi.fn().mockResolvedValue(transitionedRun),
        getById: vi.fn(),
        getPartialContent: vi.fn().mockResolvedValue(partial),
      },
    },
  } as unknown as ServiceContext;
}

describe("reconcileInactiveChatRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveThreadOperation.mockResolvedValue(null);
    mockPublishRunChanged.mockResolvedValue(undefined);
    mockPublishConversationChanged.mockResolvedValue(undefined);
    mockSalvageInterruptedReply.mockResolvedValue(true);
  });

  it("publishes the terminal state when execution ownership has ended", async () => {
    const interruptedRun: ChatRun = {
      ...runningRun,
      status: "interrupted",
      completedAt: "2026-09-16T12:01:00.000Z",
      updatedAt: "2026-09-16T12:01:00.000Z",
      terminalReason: "Execution ownership ended before the run completed.",
    };
    const context = createContext(interruptedRun);

    await expect(reconcileInactiveChatRun(context, runningRun)).resolves.toEqual(interruptedRun);

    expect(mockPublishRunChanged).toHaveBeenCalledWith(
      expect.objectContaining({ env: context.env }),
      interruptedRun,
    );
    expect(mockPublishConversationChanged).toHaveBeenCalledWith(
      expect.objectContaining({ env: context.env }),
      interruptedRun.conversationId,
      { runId: interruptedRun.id },
    );
  });

  it("keeps the streamed text when a dead run is settled", async () => {
    const interruptedRun: ChatRun = { ...runningRun, status: "interrupted" };
    const context = createContext(interruptedRun, "Half of the answer");

    await reconcileInactiveChatRun(context, runningRun);

    expect(mockSalvageInterruptedReply).toHaveBeenCalledWith(
      context,
      interruptedRun,
      "Half of the answer",
    );
  });

  it("leaves a run alone while its owner still holds the thread", async () => {
    mockGetActiveThreadOperation.mockResolvedValue("user_message");
    const context = createContext({ ...runningRun, status: "interrupted" }, "Partial");

    await expect(reconcileInactiveChatRun(context, runningRun)).resolves.toBe(runningRun);

    expect(context.repositories.conversationRuns.transition).not.toHaveBeenCalled();
    expect(mockSalvageInterruptedReply).not.toHaveBeenCalled();
  });
});
