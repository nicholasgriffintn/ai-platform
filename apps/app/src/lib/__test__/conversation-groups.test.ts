import { describe, expect, it } from "vitest";

import type { Conversation } from "~/types";

import { buildConversationGroups } from "../conversation-groups";

const now = new Date();
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

const conversations: Conversation[] = [
  {
    id: "recent",
    title: "Design review",
    messages: [],
    created_at: daysAgo(90),
    updated_at: now.toISOString(),
  },
  {
    id: "stale",
    title: "Quarterly planning",
    messages: [],
    created_at: daysAgo(90),
    updated_at: daysAgo(90),
  },
];

describe("buildConversationGroups", () => {
  it("splits conversations into dated sections when grouping by date", () => {
    const groups = buildConversationGroups(conversations, { groupBy: "date", sortBy: "updated" });
    const populated = groups.filter((group) => group.conversations.length > 0);

    expect(populated.map((group) => group.title)).toEqual(["Today", "Older"]);
    expect(populated[0].conversations[0].id).toBe("recent");
  });

  it("buckets on the created date when the list is sorted by creation", () => {
    const groups = buildConversationGroups(conversations, { groupBy: "date", sortBy: "created" });
    const populated = groups.filter((group) => group.conversations.length > 0);

    expect(populated.map((group) => group.title)).toEqual(["Older"]);
    expect(populated[0].conversations).toHaveLength(2);
  });

  it("returns a single untitled section when grouping is switched off", () => {
    const groups = buildConversationGroups(conversations, { groupBy: "none", sortBy: "title" });

    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBeUndefined();
    expect(groups[0].conversations.map((conversation) => conversation.id)).toEqual([
      "recent",
      "stale",
    ]);
  });
});
