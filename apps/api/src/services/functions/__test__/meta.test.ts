import { META_NAVIGATION_DATA_KEY } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { AssistantError } from "~/utils/errors";

import { find_places, open_place, organise_conversation, read_conversation } from "../meta";

vi.mock("~/services/completions/updateChatCompletion", () => ({
  handleUpdateChatCompletion: vi.fn(async () => ({})),
}));

vi.mock("~/services/global-search", () => ({
  searchPolychat: vi.fn(async () => ({
    query: "launch",
    conversations: [],
    projects: [],
    workspaces: [],
  })),
}));

const conversationRow = {
  id: "conversation-1",
  user_id: 7,
  title: "Launch plan",
  project_id: null,
  type: "chat",
};

function createToolContext(conversationType: string | undefined) {
  const repositories = {
    conversations: {
      getConversation: vi.fn(async () => conversationRow),
      getUserConversations: vi.fn(async () => ({ conversations: [conversationRow], total: 1 })),
    },
    messages: {
      getConversationMessages: vi.fn(async () => [
        { role: "user", content: "Plan the launch" },
        { role: "assistant", content: JSON.stringify([{ type: "text", text: "Bundle-first." }]) },
        { role: "tool", content: "ignored" },
      ]),
    },
  };
  const user = { id: 7, plan_id: "pro" };

  return {
    request: {
      env: {},
      user,
      context: {
        repositories,
        user,
        requireUser: () => user,
      },
      request: {
        completion_id: "meta-1",
        conversation_type: conversationType,
      },
    },
  } as never;
}

describe("meta tools", () => {
  it("refuse to run outside the meta scope", async () => {
    for (const tool of [find_places, open_place, organise_conversation, read_conversation]) {
      await expect(
        tool.execute(
          {
            conversationId: "conversation-1",
            action: "pin",
            target: { kind: "place", place: "chat" },
          },
          createToolContext("chat"),
        ),
      ).rejects.toBeInstanceOf(AssistantError);
    }
  });

  it("lists recent conversations when no query is given", async () => {
    const result = await find_places.execute({}, createToolContext("meta"));

    expect(result.status).toBe("success");
    expect(result.data.conversations).toEqual([
      expect.objectContaining({ id: "conversation-1", title: "Launch plan" }),
    ]);
  });

  it("returns a navigation target the client can follow after checking access", async () => {
    const result = await open_place.execute(
      { target: { kind: "conversation", conversationId: "conversation-1" } },
      createToolContext("meta"),
    );

    expect(result.data[META_NAVIGATION_DATA_KEY]).toEqual({
      kind: "conversation",
      conversationId: "conversation-1",
    });
  });

  it("reads a bounded transcript of user and assistant turns only", async () => {
    const result = await read_conversation.execute(
      { conversationId: "conversation-1" },
      createToolContext("meta"),
    );

    expect(result.content).toContain("user: Plan the launch");
    expect(result.content).toContain("assistant: Bundle-first.");
    expect(result.content).not.toContain("ignored");
    expect(result.data.messageCount).toBe(2);
  });
});
