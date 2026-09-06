import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { listSavedMessages, saveMessage, unsaveMessage } from "../index";

const requireConversationAccess = vi.hoisted(() => vi.fn(async () => ({ id: "conversation-1" })));

vi.mock("~/services/conversations/access", () => ({ requireConversationAccess }));

function createContext() {
  const savedMessages = {
    save: vi.fn(async () => undefined),
    unsave: vi.fn(async () => undefined),
    list: vi.fn(async () => [
      {
        id: "state-1",
        user_id: 7,
        conversation_id: "conversation-1",
        message_id: "message-1",
        note: "Read this again",
        saved_at: "2026-09-01T10:00:00.000Z",
        conversation_title: "Launch plan",
        message_content: JSON.stringify([{ type: "text", text: "  Bundle   first  " }]),
      },
    ]),
    listSavedMessageIds: vi.fn(async () => ["message-1"]),
  };

  return {
    ensureDatabase: vi.fn(),
    requireUser: () => ({ id: 7 }),
    repositories: { savedMessages },
  } as unknown as ServiceContext;
}

describe("saved messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks conversation access before keeping a message", async () => {
    const context = createContext();

    await saveMessage(context, { conversationId: "conversation-1", messageId: "message-1" });

    expect(requireConversationAccess).toHaveBeenCalledWith(context, "conversation-1");
    expect(context.repositories.savedMessages.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, messageId: "message-1", note: null }),
    );
  });

  it("keeps unsaving to the caller's own state", async () => {
    const context = createContext();

    await unsaveMessage(context, "message-1");

    expect(context.repositories.savedMessages.unsave).toHaveBeenCalledWith(7, "message-1");
  });

  it("summarises a saved message rather than returning its whole body", async () => {
    const context = createContext();

    const { messages } = await listSavedMessages(context);

    expect(messages[0]).toMatchObject({
      conversationTitle: "Launch plan",
      excerpt: "Bundle first",
      note: "Read this again",
    });
  });
});
