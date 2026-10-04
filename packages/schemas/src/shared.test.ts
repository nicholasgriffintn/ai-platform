import { describe, expect, it } from "vitest";

import { createChatCompletionsJsonSchema } from "./chat-completions.js";
import { messageSchema } from "./shared.js";

describe("messageSchema", () => {
  it("rejects unknown compaction progress statuses when parsing durable messages", () => {
    const parsed = messageSchema.safeParse({
      id: "snapshot-1-compaction",
      role: "compaction",
      content: "Automatically compacting context",
      parts: [
        {
          type: "compaction",
          status: "unknown",
          label: "Automatically compacting context",
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects pending compaction status rows when parsing durable messages", () => {
    const parsed = messageSchema.safeParse({
      id: "snapshot-1-compaction",
      role: "compaction",
      content: "Automatically compacting context",
      parts: [
        {
          type: "compaction",
          status: "pending",
          label: "Automatically compacting context",
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects role-only compaction messages when parsing durable messages", () => {
    const parsed = messageSchema.safeParse({
      id: "snapshot-1-compaction",
      role: "compaction",
      content: "Context automatically compacted",
    });

    expect(parsed.success).toBe(false);
  });

  it("does not allow compaction status messages in provider chat completion requests", () => {
    expect(
      createChatCompletionsJsonSchema.safeParse({
        model: "test-model",
        messages: [
          {
            id: "snapshot-1-compaction",
            role: "compaction",
            content: "Context automatically compacted",
            parts: [
              {
                type: "compaction",
                status: "completed",
                label: "Context automatically compacted",
              },
            ],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("does not allow role-only compaction messages in provider chat completion requests", () => {
    expect(
      createChatCompletionsJsonSchema.safeParse({
        model: "test-model",
        messages: [
          {
            id: "snapshot-1-compaction",
            role: "compaction",
            content: "Context automatically compacted",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("does not allow assistant-shaped compaction status messages in provider chat completion requests", () => {
    expect(
      createChatCompletionsJsonSchema.safeParse({
        model: "test-model",
        messages: [
          {
            id: "snapshot-1-compaction",
            role: "assistant",
            parts: [
              {
                type: "compaction",
                status: "completed",
                label: "Context automatically compacted",
              },
            ],
          },
        ],
      }).success,
    ).toBe(false);
  });
});
