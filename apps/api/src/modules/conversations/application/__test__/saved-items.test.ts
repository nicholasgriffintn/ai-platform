import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { SavedItemRepository } from "~/modules/conversations/infrastructure/SavedItemRepository";

import { listSavedItems, saveItem, unsaveItem } from "../saved-items";

const requireConversationAccess = vi.hoisted(() => vi.fn(async () => ({ id: "conversation-1" })));

vi.mock("~/modules/conversations/application/access", () => ({ requireConversationAccess }));

const savedRow = {
  user_id: 7,
  conversation_id: "conversation-1",
  message_id: "message-1",
  note: "Read this again",
  saved_at: "2026-09-01T10:00:00.000Z",
  conversation_title: "Launch plan",
  message_content: JSON.stringify([{ type: "text", text: "  Bundle   first  " }]),
};

function createContext() {
  const savedItems = {
    save: vi.fn(async () => undefined),
    unsave: vi.fn(async () => undefined),
    find: vi.fn(async () => savedRow),
    list: vi.fn(async () => [savedRow, { ...savedRow, message_id: "message-2" }]),
    belongsToConversation: vi.fn(async () => true),
  };

  const context = {
    ensureDatabase: vi.fn(),
    requireUser: () => ({ id: 7 }),
    repositories: fakeRepositories([[SavedItemRepository, savedItems]]),
  } as unknown as ServiceContext;

  return { context, savedItems };
}

describe("saved items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses an item from a conversation other than the one checked", async () => {
    const { context, savedItems } = createContext();

    savedItems.belongsToConversation.mockResolvedValueOnce(false);

    await expect(
      saveItem(context, { conversation_id: "conversation-1", item_id: "someone-elses" }),
    ).rejects.toThrow(/not part of this conversation/);
    expect(savedItems.save).not.toHaveBeenCalled();
  });

  it("checks conversation access before keeping an item and returns it", async () => {
    const { context, savedItems } = createContext();

    const saved = await saveItem(context, {
      conversation_id: "conversation-1",
      item_id: "message-1",
    });

    expect(requireConversationAccess).toHaveBeenCalledWith(context, "conversation-1");
    expect(savedItems.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, messageId: "message-1", note: null }),
    );
    expect(saved.id).toBe("message-1");
  });

  it("keeps unsaving to the caller's own state", async () => {
    const { context, savedItems } = createContext();

    await unsaveItem(context, "message-1");

    expect(savedItems.unsave).toHaveBeenCalledWith(7, "message-1");
  });

  it("checks access when filtering by conversation and pages by cursor", async () => {
    const { context, savedItems } = createContext();

    const page = await listSavedItems(context, { limit: 1, conversationId: "conversation-1" });

    expect(requireConversationAccess).toHaveBeenCalledWith(context, "conversation-1");
    expect(savedItems.list).toHaveBeenCalledWith(7, { limit: 1, conversationId: "conversation-1" });
    expect(page).toMatchObject({ object: "list", has_more: true, last_id: "message-1" });
    expect(page.data[0]).toMatchObject({
      conversation_title: "Launch plan",
      excerpt: "Bundle first",
      note: "Read this again",
    });
  });
});
