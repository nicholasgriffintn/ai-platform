import { describe, expect, it } from "vitest";

import { preserveOptimisticMessages, type ConversationWithMessages } from "./conversations.js";
import { mergeChatRequestOptions } from "./request-options.js";

describe("chat policies", () => {
  it("preserves project metadata while merging request options", () => {
    expect(
      mergeChatRequestOptions(
        { metadata: { project_id: "project-1" }, options: { agent: { minToolCalls: 1 } } },
        { metadata: { recipe_id: "recipe-1" } },
      ),
    ).toMatchObject({ metadata: { project_id: "project-1", recipe_id: "recipe-1" } });
  });

  it("keeps cached streaming content when the fetched conversation is behind", () => {
    const fetched: ConversationWithMessages = { title: "Chat", messages: [] };
    const cached: ConversationWithMessages = {
      title: "Chat",
      messages: [{ role: "assistant", content: "Streaming" }],
    };

    expect(preserveOptimisticMessages(fetched, cached)?.messages).toEqual(cached.messages);
  });
});
