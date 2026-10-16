import { describe, expect, it, vi } from "vitest";

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";

import {
  handleDeleteAllChatCompletions,
  type DeleteAllChatCompletionsContext,
} from "../deleteAllChatCompletions";

describe("handleDeleteAllChatCompletions", () => {
  it("deletes the signed-in user's personal conversations through the repository seam", async () => {
    const deleteAllPersonalConversations = vi.fn(async () => undefined);
    const context: DeleteAllChatCompletionsContext = {
      requireUser: () => ({ id: 123 }),
      repositories: fakeRepositories([
        [ConversationRepository, { deleteAllPersonalConversations }],
      ]),
    };

    const result = await handleDeleteAllChatCompletions(context);

    expect(deleteAllPersonalConversations).toHaveBeenCalledWith(123);
    expect(result).toEqual({
      success: true,
      message: "Conversations have been deleted",
    });
  });

  it("does not report success when the bulk deletion fails", async () => {
    const context: DeleteAllChatCompletionsContext = {
      requireUser: () => ({ id: 123 }),
      repositories: fakeRepositories([
        [
          ConversationRepository,
          {
            deleteAllPersonalConversations: vi.fn(async () => {
              throw new Error("database unavailable");
            }),
          },
        ],
      ]),
    };

    await expect(handleDeleteAllChatCompletions(context)).rejects.toThrow("database unavailable");
  });
});
