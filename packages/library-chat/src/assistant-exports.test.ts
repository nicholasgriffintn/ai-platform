import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";

import { parseAssistantExport, readAssistantExport } from "./assistant-exports.js";

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

  it("reads human messages from a Claude export", () => {
    expect(
      parseAssistantExport([
        [
          {
            name: "Garden",
            created_at: "2025-04-01T09:00:00Z",
            chat_messages: [
              {
                sender: "human",
                text: "",
                content: [{ type: "text", text: "We have clay soil." }],
              },
              { sender: "assistant", text: "Try raised beds." },
            ],
          },
        ],
      ]),
    ).toEqual({
      kind: "conversations",
      source: "claude",
      conversations: [
        {
          title: "Garden",
          createdAt: "2025-04-01T09:00:00Z",
          messages: [{ text: "We have clay soil." }],
        },
      ],
    });
  });

  it("rejects files that are not a chat export", () => {
    expect(parseAssistantExport([{ conversations: [] }])).toBeNull();
    expect(parseAssistantExport([[{ title: "No messages here" }]])).toBeNull();
  });
});

describe("readAssistantExport", () => {
  it("merges conversations from every part of a split export and skips the other parts", async () => {
    const claudeConversation = (name: string, text: string) => ({
      name,
      chat_messages: [{ sender: "human", text }],
    });
    const part = (name: string, files: Record<string, unknown>) =>
      Object.assign(
        new Blob([
          zipSync(
            Object.fromEntries(
              Object.entries(files).map(([path, value]) => [path, strToU8(JSON.stringify(value))]),
            ),
          ),
        ]),
        { name },
      );

    const parsed = await readAssistantExport([
      part("conversations-000.zip", {
        "conversations.json": [claudeConversation("Garden", "We have clay soil.")],
      }),
      part("conversations-001.zip", {
        "conversations/abc.json": claudeConversation("Bikes", "I commute by bike."),
      }),
      part("projects-000.zip", { "projects.json": [{ name: "Allotment", docs: [] }] }),
    ]);

    expect(parsed?.source).toBe("claude");
    expect(parsed?.conversations.map((conversation) => conversation.title)).toEqual([
      "Garden",
      "Bikes",
    ]);
  });
});
