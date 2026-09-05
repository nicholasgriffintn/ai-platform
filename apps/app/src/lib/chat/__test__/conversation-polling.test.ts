import type { ChatRunStatus } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import type { Conversation } from "~/types";

import { getConversationRefetchInterval } from "../conversation-polling";

function conversation(status?: ChatRunStatus): Conversation {
  return {
    id: "conversation-1",
    title: "Conversation",
    messages: [],
    latest_run: status
      ? {
          protocolVersion: 1,
          id: "run-1",
          conversationId: "conversation-1",
          projectId: null,
          projectTaskId: null,
          initiatorUserId: 7,
          status,
          attempt: 1,
          createdAt: "2026-09-05T12:00:00.000Z",
          updatedAt: "2026-09-05T12:00:01.000Z",
          startedAt: "2026-09-05T12:00:01.000Z",
          completedAt: null,
          terminalReason: null,
          lastMessageId: null,
        }
      : null,
  };
}

describe("getConversationRefetchInterval", () => {
  it("leaves authoritative run polling to the ordered replay hook", () => {
    expect(getConversationRefetchInterval(conversation("running"))).toBe(false);
    expect(getConversationRefetchInterval(conversation("awaiting_approval"))).toBe(false);
    expect(getConversationRefetchInterval(conversation("cancelling"))).toBe(false);
  });

  it("stops run polling after terminal outcomes", () => {
    expect(getConversationRefetchInterval(conversation("succeeded"))).toBe(false);
    expect(getConversationRefetchInterval(conversation("failed"))).toBe(false);
    expect(getConversationRefetchInterval(conversation("cancelled"))).toBe(false);
    expect(getConversationRefetchInterval(conversation("interrupted"))).toBe(false);
  });
});
