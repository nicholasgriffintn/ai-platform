import { describe, expect, it } from "vitest";

import { parseAssistantExport } from "./assistant-exports.js";

const CUSTOM_INSTRUCTIONS = {
  author: { role: "user" },
  create_time: null,
  content: {
    content_type: "user_editable_context",
    user_profile: "I teach chemistry in Bristol.",
    user_instructions: "Use British spelling.",
  },
};

function chatGptConversation(title: string, userText: string) {
  return {
    title,
    create_time: 1_700_000_000,
    current_node: "answer",
    mapping: {
      root: { parent: null, message: null },
      context: { parent: "root", message: CUSTOM_INSTRUCTIONS },
      edited: {
        parent: "context",
        message: {
          author: { role: "user" },
          create_time: 1_700_000_010,
          content: { content_type: "text", parts: ["An abandoned draft"] },
        },
      },
      question: {
        parent: "context",
        message: {
          author: { role: "user" },
          create_time: 1_700_000_020,
          content: { content_type: "multimodal_text", parts: [{ asset: "image" }, userText] },
        },
      },
      answer: {
        parent: "question",
        message: {
          author: { role: "assistant" },
          create_time: 1_700_000_030,
          content: { content_type: "text", parts: ["Here you go"] },
        },
      },
    },
  };
}

describe("parseAssistantExport", () => {
  it("reads the user's side of the current ChatGPT thread, keeping custom instructions once", () => {
    const parsed = parseAssistantExport([
      [
        chatGptConversation("Lesson plans", "Plan a titration practical"),
        chatGptConversation("Marking", "Mark these lab reports"),
      ],
    ]);

    expect(parsed).toEqual({
      kind: "conversations",
      source: "chatgpt",
      conversations: [
        {
          title: "Lesson plans",
          createdAt: "2023-11-14T22:13:20.000Z",
          messages: [
            { text: "I teach chemistry in Bristol.\n\nUse British spelling." },
            { text: "Plan a titration practical", createdAt: "2023-11-14T22:13:40.000Z" },
          ],
        },
        {
          title: "Marking",
          createdAt: "2023-11-14T22:13:20.000Z",
          messages: [{ text: "Mark these lab reports", createdAt: "2023-11-14T22:13:40.000Z" }],
        },
      ],
    });
  });

  it("rejects files that are not a chat export", () => {
    expect(parseAssistantExport([{ conversations: [] }])).toBeNull();
    expect(parseAssistantExport([[{ title: "No messages here" }]])).toBeNull();
  });
});
