import { describe, expect, it } from "vitest";

import { listConversationArtifacts, summariseConversationUsage } from "./conversation-insights.js";
import type { Message } from "./conversation-types.js";

function assistant(id: string, content: string, extra: Partial<Message> = {}): Message {
  return { id, role: "assistant", content, ...extra };
}

function artifactMarkup(identifier: string, body: string, title?: string): string {
  const titleAttribute = title ? ` title="${title}"` : "";

  return `<artifact identifier="${identifier}" type="text/markdown"${titleAttribute}>${body}</artifact>`;
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

describe("listConversationArtifacts", () => {
  it("keeps one entry per artifact, newest edit first, counting revisions", () => {
    const artifacts = listConversationArtifacts([
      assistant("a1", artifactMarkup("menu", "v1", "Menu")),
      assistant("a2", artifactMarkup("list", "milk", "List")),
      assistant("a3", artifactMarkup("menu", "v2")),
    ]);

    expect(artifacts.map((entry) => [entry.identifier, entry.title, entry.revisions])).toEqual([
      ["menu", "Menu", 2],
      ["list", "List", 1],
    ]);
    expect(artifacts[0]?.content).toBe("v2");
    expect(artifacts[0]?.messageId).toBe("a3");
  });
});
