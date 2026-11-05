import { beforeEach, describe, expect, it, vi } from "vitest";

import { runComparison } from "../comparison";
import type { PanelCompletionScope, PanelMember } from "../panel";

const mocks = vi.hoisted(() => ({ complete: vi.fn() }));

vi.mock("../panel", () => ({
  createPanelCompletion: vi.fn(async () => ({
    complete: mocks.complete,
    readSpend: () => ({
      costUsd: 0.012,
      pricedCalls: 3,
      totalCalls: 3,
      inputTokens: 300,
      outputTokens: 120,
    }),
  })),
}));

const member = (id: string): PanelMember => ({
  id,
  name: `Model ${id}`,
  role: "Comparison",
  instruction: "",
  model: id,
  provider: `vendor-${id}`,
});

const request = {
  question: "Monorepo or polyrepo?",
  original: { name: "Original model", model: "original", content: "Monorepo." },
  members: [member("a"), member("b")],
};

const scope = { completionId: "conversation" } as PanelCompletionScope;
const conclusion = JSON.stringify({ agreements: [], disagreements: [], conclusion: "Monorepo." });

describe("runComparison", () => {
  beforeEach(() => {
    mocks.complete.mockReset();
  });

  it("asks every model the same question before any answer is shared", async () => {
    mocks.complete
      .mockResolvedValueOnce("Answer A")
      .mockResolvedValueOnce("Answer B")
      .mockResolvedValueOnce(conclusion);

    const result = await runComparison(scope, request);

    expect(mocks.complete.mock.calls[0]?.[1]).toBe(mocks.complete.mock.calls[1]?.[1]);
    expect(mocks.complete.mock.calls[0]?.[1]).not.toContain("Monorepo.");
    expect(result.answers.map((answer) => answer.content)).toEqual([
      "Monorepo.",
      "Answer A",
      "Answer B",
    ]);
    expect(result.spend.costUsd).toBe(0.012);
  });

  it("gives the conclusion every labelled answer, including the original", async () => {
    mocks.complete
      .mockResolvedValueOnce("Answer A")
      .mockResolvedValueOnce("Answer B")
      .mockResolvedValueOnce(conclusion);

    await runComparison(scope, request);

    const prompt = mocks.complete.mock.calls[2]?.[1];

    expect(prompt).toContain('<answer model="Original model">\nMonorepo.');
    expect(prompt).toContain('<answer model="Model a">\nAnswer A');
    expect(prompt).toContain('<answer model="Model b">\nAnswer B');
    expect(mocks.complete.mock.calls[2]?.[2]).toBeUndefined();
  });

  it("concludes from the models that answered when one fails", async () => {
    mocks.complete
      .mockRejectedValueOnce(new Error("provider down"))
      .mockResolvedValueOnce("Answer B")
      .mockResolvedValueOnce(conclusion);

    const result = await runComparison(scope, request);

    expect(result.answers.map((answer) => answer.name)).toEqual(["Original model", "Model b"]);
  });

  it("fails without a conclusion when no other model answers", async () => {
    mocks.complete.mockRejectedValue(new Error("provider down"));

    await expect(runComparison(scope, request)).rejects.toThrow("provider down");
    expect(mocks.complete).toHaveBeenCalledTimes(2);
  });
});
