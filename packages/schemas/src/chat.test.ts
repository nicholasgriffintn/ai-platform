import { describe, expect, it } from "vitest";

import {
  compactChatCompletionResponseSchema,
  getChatCompletionMessagesResponseSchema,
  submitChatCompletionFeedbackJsonSchema,
} from "./chat.js";

describe("chat schemas", () => {
  it("accepts only thumb feedback and bounded optional scores", () => {
    expect(
      submitChatCompletionFeedbackJsonSchema.parse({
        message_id: "message-1",
        feedback: 1,
        score: 100,
      }),
    ).toEqual({ message_id: "message-1", feedback: 1, score: 100 });
    expect(
      submitChatCompletionFeedbackJsonSchema.parse({
        log_id: "gateway-log-1",
        feedback: -1,
      }),
    ).toEqual({ log_id: "gateway-log-1", feedback: -1 });
    expect(
      submitChatCompletionFeedbackJsonSchema.safeParse({
        log_id: "gateway-log-1",
        feedback: 0,
      }),
    ).toMatchObject({ success: false });
    expect(
      submitChatCompletionFeedbackJsonSchema.safeParse({
        log_id: "gateway-log-1",
        feedback: -1,
        score: 101,
      }),
    ).toMatchObject({ success: false });
  });

  it("keeps backward-page state alongside the authorised message window", () => {
    expect(
      getChatCompletionMessagesResponseSchema.parse({
        conversation_id: "conversation-1",
        messages: [{ id: "message-101", role: "assistant", content: "Newest page" }],
        has_more: true,
        oldest_message_id: "message-101",
      }),
    ).toMatchObject({
      has_more: true,
      oldest_message_id: "message-101",
    });
  });

  it("rejects compact responses without valid visible messages", () => {
    const result = compactChatCompletionResponseSchema.safeParse({
      compacted: true,
      conversation: {
        id: "conversation-1",
        messages: [
          {
            id: "snapshot-1-compaction",
            role: "status",
            content: "Context compacted",
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects compact responses with role-only compaction markers", () => {
    const result = compactChatCompletionResponseSchema.safeParse({
      compacted: true,
      conversation: {
        id: "conversation-1",
        messages: [
          {
            id: "snapshot-1-compaction",
            role: "compaction",
            content: "Context compacted",
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects compacted responses that do not include a visible compaction message", () => {
    const result = compactChatCompletionResponseSchema.safeParse({
      compacted: true,
      conversation: {
        id: "conversation-1",
        messages: [
          {
            id: "assistant-1",
            role: "assistant",
            content: "Previous answer",
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });
});
