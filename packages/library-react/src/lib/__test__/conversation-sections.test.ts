import { describe, expect, it } from "vitest";

import { buildConversationSections } from "../conversation-sections";

const now = new Date();
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

const conversations = [
  {
    id: "recent",
    type: "task" as const,
    title: "Design review",
    createdAt: daysAgo(90),
    updatedAt: now.toISOString(),
  },
  {
    id: "stale",
    type: "chat" as const,
    title: "Quarterly planning",
    createdAt: daysAgo(90),
    updatedAt: daysAgo(90),
  },
];

describe("buildConversationSections", () => {
  it("splits conversations into dated sections when grouping by date", () => {
    const sections = buildConversationSections(conversations, {
      groupBy: "date",
      sortBy: "updated",
    });
    const populated = sections.filter((section) => section.conversations.length > 0);

    expect(populated.map((section) => section.title)).toEqual(["Today", "Older"]);
    expect(populated[0].conversations[0].id).toBe("recent");
  });

  it("buckets on the created date when the list is sorted by creation", () => {
    const sections = buildConversationSections(conversations, {
      groupBy: "date",
      sortBy: "created",
    });
    const populated = sections.filter((section) => section.conversations.length > 0);

    expect(populated.map((section) => section.title)).toEqual(["Older"]);
    expect(populated[0].conversations).toHaveLength(2);
  });

  it("returns a single untitled section when grouping is switched off", () => {
    const sections = buildConversationSections(
      [
        ...conversations,
        { id: "numbered-ten", type: "chat", title: "10. Web search" },
        { id: "numbered-two", type: "chat", title: "2. React artifacts" },
      ],
      { groupBy: "none", sortBy: "title" },
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBeUndefined();
    expect(sections[0].conversations.map((conversation) => conversation.id)).toEqual([
      "numbered-two",
      "numbered-ten",
      "recent",
      "stale",
    ]);
  });

  it("separates task runs from ordinary chats when grouping by type", () => {
    const sections = buildConversationSections(conversations, {
      groupBy: "type",
      sortBy: "updated",
    });

    expect(sections.map((section) => section.title)).toEqual(["Tasks", "Chats"]);
    expect(sections[0].conversations.map((conversation) => conversation.id)).toEqual(["recent"]);
    expect(sections[1].conversations.map((conversation) => conversation.id)).toEqual(["stale"]);
  });

  it("lists user groups ahead of the remaining sections and keeps grouped conversations out of them", () => {
    const platform = { id: "g1", name: "Platform", scope: { kind: "personal" as const } };
    const design = { id: "g2", name: "Design", scope: { kind: "personal" as const } };
    const sections = buildConversationSections(
      [
        { ...conversations[0], group: platform },
        { ...conversations[1] },
        {
          id: "grouped-old",
          type: "chat",
          title: "Old brief",
          updatedAt: daysAgo(40),
          group: design,
        },
        {
          id: "grouped-pinned",
          type: "chat",
          title: "Pinned brief",
          updatedAt: daysAgo(60),
          isPinned: true,
          group: design,
        },
      ],
      { groupBy: "date", sortBy: "updated" },
    );
    const populated = sections.filter((section) => section.conversations.length > 0);

    expect(populated.map((section) => section.title)).toEqual(["Design", "Platform", "Older"]);
    expect(populated[0].conversations.map((conversation) => conversation.id)).toEqual([
      "grouped-pinned",
      "grouped-old",
    ]);
    expect(populated[2].conversations.map((conversation) => conversation.id)).toEqual(["stale"]);
  });
});
