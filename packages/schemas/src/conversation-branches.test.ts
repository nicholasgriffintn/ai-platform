import { describe, expect, it } from "vitest";

import { flattenConversationBranches, type ConversationBranch } from "./conversation-branches";

const root: ConversationBranch = {
  id: "root",
  title: "Root",
  parent_conversation_id: null,
  created_at: "2026-09-01",
  is_archived: false,
};

describe("conversation branch navigation", () => {
  it("places parents before their descendants without dropping orphaned branches", () => {
    const result = flattenConversationBranches([
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
  it("visits each branch only once when legacy parent links contain a cycle", () => {
    const result = flattenConversationBranches([
      { ...root, id: "a", parent_conversation_id: "b" },
      { ...root, id: "b", parent_conversation_id: "a" },
      { ...root, id: "self", parent_conversation_id: "self" },
    ]);

    expect(result.map(({ id }) => id)).toEqual(["a", "b", "self"]);
  });
});
