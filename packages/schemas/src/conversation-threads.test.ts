import { describe, expect, it } from "vitest";

import { flattenConversationThreads, type ConversationThread } from "./conversation-threads";

const root: ConversationThread = {
  id: "root",
  title: "Root",
  parent_conversation_id: null,
  created_at: "2026-09-01",
  is_archived: false,
};

describe("conversation thread navigation", () => {
  it("places parents before their descendants without dropping orphaned threads", () => {
    const result = flattenConversationThreads([
      { ...root, id: "child", parent_conversation_id: "root" },
      { ...root, id: "orphan", parent_conversation_id: "missing" },
      root,
      { ...root, id: "grandchild", parent_conversation_id: "child" },
    ]);

    expect(result.map(({ id, depth }) => [id, depth])).toEqual([
      ["orphan", 0],
      ["root", 0],
      ["child", 1],
      ["grandchild", 2],
    ]);
  });
  it("visits each thread only once when legacy parent links contain a cycle", () => {
    const result = flattenConversationThreads([
      { ...root, id: "a", parent_conversation_id: "b" },
      { ...root, id: "b", parent_conversation_id: "a" },
      { ...root, id: "self", parent_conversation_id: "self" },
    ]);

    expect(result.map(({ id }) => id)).toEqual(["a", "b", "self"]);
  });
});
