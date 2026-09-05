import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import {
  PROJECT_TASK_INTERACTION_TTL_MS,
  recoverPendingProjectTaskInteraction,
} from "../interaction-recovery";

function createContext(message: Record<string, unknown> | null) {
  const updateMessage = vi.fn().mockResolvedValue(undefined);

  return {
    context: {
      repositories: {
        messages: {
          getLatestPendingToolMessage: vi.fn().mockResolvedValue(message),
          updateMessage,
        },
      },
    } as unknown as ServiceContext,
    updateMessage,
  };
}

describe("project-task interaction recovery", () => {
  it("rehydrates a stored interaction while it remains inside its recovery window", async () => {
    const now = Date.parse("2026-09-05T12:00:00.000Z");
    const { context, updateMessage } = createContext({
      id: "message-1",
      name: "ask_user",
      created_at: new Date(now - PROJECT_TASK_INTERACTION_TTL_MS + 1).toISOString(),
      data: { humanInTheLoop: { status: "pending" } },
    });
    const writeFence = { assertOwned: vi.fn().mockResolvedValue(undefined) };

    const result = await recoverPendingProjectTaskInteraction({
      context,
      conversationId: "conversation-1",
      kind: "input",
      writeFence,
      now,
    });

    expect(result).toEqual({ recovered: true });
    expect(updateMessage).not.toHaveBeenCalled();
  });

  it("expires a stale stored interaction before recovery continues", async () => {
    const now = Date.parse("2026-09-05T12:00:00.000Z");
    const { context, updateMessage } = createContext({
      id: "message-1",
      name: "ask_user",
      content: "Waiting for an answer",
      created_at: new Date(now - PROJECT_TASK_INTERACTION_TTL_MS).toISOString(),
      data: { humanInTheLoop: { status: "pending", requires_user_action: true } },
    });
    const writeFence = { assertOwned: vi.fn().mockResolvedValue(undefined) };

    const result = await recoverPendingProjectTaskInteraction({
      context,
      conversationId: "conversation-1",
      kind: "input",
      writeFence,
      now,
    });

    expect(result).toEqual({
      recovered: false,
      reason: "The pending interaction expired before the durable task resumed.",
    });
    expect(writeFence.assertOwned).toHaveBeenCalledOnce();
    expect(updateMessage).toHaveBeenCalledWith(
      "conversation-1",
      "message-1",
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
  });
});
