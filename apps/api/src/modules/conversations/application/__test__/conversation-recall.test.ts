import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

const mocks = vi.hoisted(() => ({ requireProjectAccess: vi.fn() }));

vi.mock("~/modules/workspaces/application/access", () => ({
  requireProjectAccess: mocks.requireProjectAccess,
}));

import { recallSearchTerms, searchPastConversations } from "../conversation-recall";

function createContext(rows: unknown[] = []) {
  const searchConversationExcerpts = vi.fn(async () => rows);

  return {
    searchConversationExcerpts,
    context: {
      requireUser: () => ({ id: 7 }),
      repositories: { messages: { searchConversationExcerpts } },
    } as unknown as ServiceContext,
  };
}

describe("searchPastConversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("searches personal conversations only when no project is in scope", async () => {
    const { context, searchConversationExcerpts } = createContext();

    await searchPastConversations(context, { query: "lisbon trip", projectId: null, limit: 5 });

    expect(mocks.requireProjectAccess).not.toHaveBeenCalled();
    expect(searchConversationExcerpts).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, projectId: null, terms: ["lisbon", "trip"] }),
    );
  });

  it("checks project access before searching a project's conversations", async () => {
    mocks.requireProjectAccess.mockRejectedValue(new Error("Project not found"));
    const { context, searchConversationExcerpts } = createContext();

    await expect(
      searchPastConversations(context, { query: "release", projectId: "project-1", limit: 5 }),
    ).rejects.toThrow("Project not found");
    expect(searchConversationExcerpts).not.toHaveBeenCalled();
  });

  it("returns one excerpt per conversation, newest first", async () => {
    const { context } = createContext([
      {
        conversation_id: "c1",
        title: "Trip",
        role: "user",
        content: "Book Lisbon",
        created_at: "2026-06-03T10:00:00Z",
      },
      {
        conversation_id: "c1",
        title: "Trip",
        role: "assistant",
        content: "Lisbon flights",
        created_at: "2026-06-02T10:00:00Z",
      },
      {
        conversation_id: "c2",
        title: null,
        role: "user",
        content: "Lisbon again",
        created_at: "2026-05-01T10:00:00Z",
      },
    ]);

    const matches = await searchPastConversations(context, {
      query: "lisbon",
      projectId: null,
      limit: 5,
    });

    expect(matches.map((match) => [match.conversationId, match.title, match.date])).toEqual([
      ["c1", "Trip", "2026-06-03"],
      ["c2", "Untitled conversation", "2026-05-01"],
    ]);
  });
});

describe("recallSearchTerms", () => {
  it("drops punctuation, short words and duplicates", () => {
    expect(recallSearchTerms("The Lisbon trip, a LISBON plan!")).toEqual([
      "the",
      "lisbon",
      "trip",
      "plan",
    ]);
  });
});
