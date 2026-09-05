import type { ChatRun, ChatRunEvent } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { handleReplayChatRunEvents } from "../replay";

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

function event(sequence: number): ChatRunEvent {
  return {
    protocolVersion: 1,
    id: `event-${sequence}`,
    runId: run.id,
    sequence,
    attempt: 1,
    type: "run.status_changed",
    occurredAt: `2026-09-05T12:00:0${sequence}.000Z`,
    data: { status: "running" },
  };
}

function createContext(options?: {
  oldest?: number | null;
  latest?: number;
  events?: ChatRunEvent[];
  userId?: number;
}) {
  return {
    requireUser: vi.fn().mockReturnValue({ id: options?.userId ?? 7, plan_id: "pro" }),
    ensureDatabase: vi.fn(),
    repositories: {
      conversationRuns: {
        getById: vi.fn().mockResolvedValue(run),
        getEventCursor: vi.fn().mockResolvedValue(options?.latest ?? 5),
        getEventWindow: vi.fn().mockResolvedValue({
          oldest: options?.oldest === undefined ? 1 : options.oldest,
          latest: options?.latest ?? 5,
        }),
        listEvents: vi.fn().mockResolvedValue(options?.events ?? [event(4), event(5)]),
      },
      messages: {
        getRunMessages: vi.fn().mockResolvedValue([
          {
            id: "assistant-1",
            conversation_id: run.conversationId,
            run_id: run.id,
            role: "assistant",
            content: "Current result",
          },
        ]),
      },
      usageEvents: {
        summariseChatRuns: vi.fn().mockResolvedValue([]),
      },
      usageReservations: {
        listReservations: vi.fn().mockResolvedValue([]),
      },
    },
  } as unknown as ServiceContext;
}

describe("handleReplayChatRunEvents", () => {
  it("returns a contiguous ordered page after the supplied cursor", async () => {
    const context = createContext();

    await expect(
      handleReplayChatRunEvents(context, run.id, { after: 3, limit: 100 }),
    ).resolves.toMatchObject({
      fromCursor: 3,
      nextCursor: 5,
      resetRequired: false,
      events: [{ sequence: 4 }, { sequence: 5 }],
      snapshot: null,
    });
  });

  it("returns an authoritative reset when retention passed the cursor", async () => {
    const context = createContext({ oldest: 8, latest: 507, events: [] });

    await expect(
      handleReplayChatRunEvents(context, run.id, { after: 3, limit: 100 }),
    ).resolves.toMatchObject({
      fromCursor: 3,
      nextCursor: 507,
      resetRequired: true,
      events: [],
      snapshot: {
        protocolVersion: 1,
        cursor: 507,
        run: { id: run.id },
        messages: [{ id: "assistant-1" }],
      },
    });
  });

  it("turns a concurrent retention jump into a reset instead of hiding the gap", async () => {
    const context = createContext({ oldest: 1, latest: 5, events: [event(5)] });

    await expect(
      handleReplayChatRunEvents(context, run.id, { after: 3, limit: 100 }),
    ).resolves.toMatchObject({ resetRequired: true, events: [], snapshot: { cursor: 5 } });
  });

  it("turns an internal replay hole into a reset", async () => {
    const context = createContext({ oldest: 1, latest: 6, events: [event(4), event(6)] });

    await expect(
      handleReplayChatRunEvents(context, run.id, { after: 3, limit: 100 }),
    ).resolves.toMatchObject({ resetRequired: true, events: [], snapshot: { cursor: 6 } });
  });

  it("authorises every replay request before exposing its event window", async () => {
    const context = createContext({ userId: 8 });

    await expect(
      handleReplayChatRunEvents(context, run.id, { after: 0, limit: 100 }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(context.repositories.conversationRuns.getEventWindow).not.toHaveBeenCalled();
  });
});
