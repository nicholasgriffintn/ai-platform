import { filterConversationsByListOptions } from "@ngriffin_uk/polychat-library-chat/conversations";
import { describe, expect, it } from "vitest";

import type { Conversation } from "~/types";

const conversations: Conversation[] = [
  {
    id: "active-old",
    title: "Quarterly planning",
    messages: [],
    created_at: "2026-06-01T10:00:00.000Z",
    updated_at: "2026-06-04T10:00:00.000Z",
    is_archived: false,
  },
  {
    id: "active-new",
    title: "Design review",
    messages: [],
    created_at: "2026-06-02T10:00:00.000Z",
    updated_at: "2026-06-05T10:00:00.000Z",
    is_archived: false,
  },
  {
    id: "archived",
    title: "Design archive",
    messages: [],
    created_at: "2026-06-03T10:00:00.000Z",
    updated_at: "2026-06-06T10:00:00.000Z",
    is_archived: true,
  },
];

describe("filterConversationsByListOptions", () => {
  it("filters local conversations by title, archive state, and selected date sort", () => {
    const result = filterConversationsByListOptions(conversations, {
      archived: "all",
      query: "design",
      sortBy: "created",
    });

    expect(result.map((conversation) => conversation.id)).toEqual(["archived", "active-new"]);
  });

  it("defaults to active conversations sorted by updated date", () => {
    const result = filterConversationsByListOptions(conversations);

    expect(result.map((conversation) => conversation.id)).toEqual(["active-new", "active-old"]);
  });

  it("cuts the activity window at the local start of day rather than a rolling 24 hours", () => {
    const now = new Date(2026, 5, 6, 10, 0, 0);
    const sameDay = new Date(2026, 5, 6, 1, 0, 0).toISOString();
    const dayBefore = new Date(2026, 5, 5, 23, 0, 0).toISOString();

    const result = filterConversationsByListOptions(
      [
        { id: "early-today", title: "Early", updated_at: sameDay },
        { id: "late-yesterday", title: "Late", updated_at: dayBefore },
      ],
      { activity: "today", archived: "all" },
      now,
    );

    expect(result.map((conversation) => conversation.id)).toEqual(["early-today"]);
  });

  it("keeps every conversation when the activity window is unbounded", () => {
    const now = new Date("2026-07-01T10:00:00.000Z");

    const result = filterConversationsByListOptions(
      conversations,
      { activity: "all", archived: "all" },
      now,
    );

    expect(result).toHaveLength(3);
  });

  it("sorts by title without regard to case when title sort is selected", () => {
    const result = filterConversationsByListOptions(
      [
        ...conversations,
        { id: "numbered-ten", title: "10. Web search", messages: [] },
        { id: "numbered-two", title: "2. React artifacts", messages: [] },
      ],
      {
        archived: "all",
        sortBy: "title",
      },
    );

    expect(result.map((conversation) => conversation.title)).toEqual([
      "2. React artifacts",
      "10. Web search",
      "Design archive",
      "Design review",
      "Quarterly planning",
    ]);
  });
});
