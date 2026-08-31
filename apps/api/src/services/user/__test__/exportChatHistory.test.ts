import { describe, expect, it } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { User } from "~/types";

import { handleExportChatHistory } from "../exportChatHistory";

const CONVERSATION_COUNT = 30;
const MESSAGES_PER_PAGE = 3;
const MESSAGE_PAGES_PER_CONVERSATION = 2;

function buildConversations(page: number): Record<string, unknown>[] {
  const offset = (page - 1) * CONVERSATION_COUNT;

  return Array.from({ length: CONVERSATION_COUNT }, (_, index) => ({
    id: `conversation-${offset + index}`,
    title: `Conversation ${offset + index}`,
    created_at: "2026-01-01T00:00:00.000Z",
  }));
}

function createContext() {
  let inFlight = 0;
  let peakInFlight = 0;

  const getUserConversations = async (
    _userId: number,
    _limit: number,
    page: number,
  ): Promise<{ conversations: Record<string, unknown>[]; totalPages: number }> => ({
    conversations: buildConversations(page),
    totalPages: 2,
  });

  const getConversationMessages = async (
    conversationId: string,
    _limit: number,
    after?: string,
  ): Promise<Record<string, unknown>[]> => {
    inFlight += 1;
    peakInFlight = Math.max(peakInFlight, inFlight);

    try {
      const index = Number(conversationId.split("-").at(-1));

      await new Promise((resolve) => setTimeout(resolve, (index % 5) * 2));

      const pageIndex = after ? Number(after.split("-").at(-1)) + 1 : 0;

      if (pageIndex >= MESSAGE_PAGES_PER_CONVERSATION * MESSAGES_PER_PAGE) {
        return [];
      }

      return Array.from({ length: MESSAGES_PER_PAGE }, (_, offset) => ({
        id: `${conversationId}-message-${pageIndex + offset}`,
        role: "user",
        content: `Message ${pageIndex + offset}`,
        timestamp: pageIndex + offset,
        model: "poly-1",
      }));
    } finally {
      inFlight -= 1;
    }
  };

  const context = {
    repositories: {
      conversations: { getUserConversations },
      messages: { getConversationMessages },
    },
  } as unknown as ServiceContext;

  return {
    context,
    getPeakInFlight: () => peakInFlight,
  };
}

describe("handleExportChatHistory", () => {
  it("returns every message grouped by conversation in conversation and message order", async () => {
    const { context } = createContext();

    const rows = await handleExportChatHistory({
      context,
      user: { id: 1 } as User,
    });

    const expectedIds: string[] = [];

    for (const page of [1, 2]) {
      for (const conversation of buildConversations(page)) {
        for (
          let messageIndex = 0;
          messageIndex < MESSAGE_PAGES_PER_CONVERSATION * MESSAGES_PER_PAGE;
          messageIndex += 1
        ) {
          expectedIds.push(`${conversation.id}-message-${messageIndex}`);
        }
      }
    }

    expect(rows.map((row) => row.message_id)).toEqual(expectedIds);
    expect(rows[0]).toEqual({
      conversation_id: "conversation-0",
      conversation_title: "Conversation 0",
      conversation_created_at: "2026-01-01T00:00:00.000Z",
      message_id: "conversation-0-message-0",
      message_role: "user",
      message_content: "Message 0",
      message_timestamp: 0,
      message_model: "poly-1",
    });
  });

  it("fans conversations out concurrently without exceeding the concurrency cap", async () => {
    const { context, getPeakInFlight } = createContext();

    await handleExportChatHistory({ context, user: { id: 1 } as User });

    expect(getPeakInFlight()).toBeGreaterThan(1);
    expect(getPeakInFlight()).toBeLessThanOrEqual(8);
  });
});
