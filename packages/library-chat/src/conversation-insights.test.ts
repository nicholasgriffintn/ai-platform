import { describe, expect, it } from "vitest";

import { summariseConversationUsage } from "./conversation-insights.js";
import type { Message } from "./conversation-types.js";

function assistant(id: string, content: string, extra: Partial<Message> = {}): Message {
  return { id, role: "assistant", content, ...extra };
}

describe("summariseConversationUsage", () => {
  it("totals reported usage and keeps the latest reply's input as the live context size", () => {
    const summary = summariseConversationUsage(
      [
        { id: "u1", role: "user", content: "Plan dinners" },
        assistant("a1", "Monday: soup", {
          model: "small",
          usage: { prompt_tokens: 900, completion_tokens: 300 },
        }),
        assistant("a2", "Grouped by aisle", {
          model: "large",
          provider: "workers-ai",
          usage: { prompt_tokens: 1400, completion_tokens: 200 },
        }),
      ],
      (model) =>
        model === "large" ? { costPer1kInputTokens: 1, costPer1kOutputTokens: 2 } : undefined,
    );

    expect(summary).toEqual({
      replies: 2,
      inputTokens: 2300,
      outputTokens: 500,
      estimatedCostUsd: expect.closeTo(1.8),
      latestInputTokens: 1400,
      latestModel: "large",
      latestProvider: "workers-ai",
    });
  });
});
