import type { MessageTokenInput } from "@ngriffin_uk/polychat-ai-providers";
import { describe, expect, it, vi } from "vitest";

import {
  applyToolRetention,
  buildRetentionQuestions,
  pruneToolHistory,
  type ToolRetention,
} from "../pruning.js";

function toolMessage(id: string, name: string, content: string): MessageTokenInput {
  return { id, role: "tool", name, content };
}

function message(role: string, content: string): MessageTokenInput {
  return { role, content } as MessageTokenInput;
}

const conversation = [
  message("user", "Find the failing test"),
  toolMessage("t1", "run_code", "x".repeat(4_000)),
  message("assistant", "Found it"),
  toolMessage("t2", "read_file", "y".repeat(4_000)),
];

function choiceAnswer(choice: ToolRetention, confidence: number) {
  return { type: "choice" as const, choice, probabilities: { [choice]: confidence }, confidence };
}

describe("buildRetentionQuestions", () => {
  it("asks about every tool step in one request and nothing else", () => {
    const questions = buildRetentionQuestions(conversation);

    expect(Object.keys(questions)).toEqual(["tool_1", "tool_3"]);
    expect(questions.tool_1).toMatchObject({
      type: "choice",
      criteria: {
        keep: expect.any(String),
        drop_result: expect.any(String),
        drop_call: expect.any(String),
      },
    });
  });

  it("ignores tool messages that cannot be addressed by id", () => {
    expect(buildRetentionQuestions([{ role: "tool", name: "x", content: "c" }])).toEqual({});
  });
});

describe("applyToolRetention", () => {
  it("removes spent steps, trims superseded results and leaves everything else alone", () => {
    const result = applyToolRetention(
      conversation,
      new Map<string, ToolRetention>([
        ["t1", "drop_call"],
        ["t2", "drop_result"],
      ]),
    );

    expect(result.map((entry) => entry.role)).toEqual(["user", "assistant", "tool"]);
    expect(String(result[2].content)).toHaveLength(300 + "\n... (pruned from context)".length);
  });

  it("never rewrites user or assistant messages", () => {
    const result = applyToolRetention(
      conversation,
      new Map<string, ToolRetention>([["t1", "drop_call"]]),
    );

    expect(result[0]).toBe(conversation[0]);
    expect(result[1]).toBe(conversation[2]);
  });
});

describe("pruneToolHistory", () => {
  const scope = { env: {} as never };

  it("returns the conversation untouched when no decision model is available", async () => {
    const tryDecide = vi.fn(async () => null);

    const result = await pruneToolHistory({ messages: conversation, decide: { tryDecide }, scope });

    expect(result.messages).toEqual(conversation);
    expect(result.ledger).toEqual([]);
    expect(result.tokensAfter).toBe(result.tokensBefore);
  });

  it("keeps a step the model is not confident about dropping", async () => {
    const tryDecide = vi.fn(async () => ({
      provider: "typesafe",
      model: "jev-latest",
      answers: { tool_1: choiceAnswer("drop_call", 0.4), tool_3: choiceAnswer("drop_call", 0.95) },
      usage: { input_tokens: 10, output_tokens: 1 },
    }));

    const result = await pruneToolHistory({
      messages: conversation,
      decide: { tryDecide } as never,
      scope,
    });

    expect(result.ledger).toEqual([
      { messageId: "t2", toolName: "read_file", retention: "drop_call", confidence: 0.95 },
    ]);
    expect(result.messages.some((entry) => entry.id === "t1")).toBe(true);
    expect(result.tokensAfter).toBeLessThan(result.tokensBefore);
  });

  it("does not consult the model when the conversation holds no tool steps", async () => {
    const tryDecide = vi.fn(async () => null);

    await pruneToolHistory({
      messages: [message("user", "hello")],
      decide: { tryDecide },
      scope,
    });

    expect(tryDecide).not.toHaveBeenCalled();
  });
});
