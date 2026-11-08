import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { SavedItemRepository } from "~/modules/conversations/infrastructure/SavedItemRepository";

import { saveItem } from "../saved-items";

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
});
