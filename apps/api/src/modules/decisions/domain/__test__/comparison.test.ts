import { describe, expect, it } from "vitest";

import type { Message } from "~/types";

import { readComparisonConclusion, resolveComparisonSubject } from "../comparison";

const messages: Message[] = [
  { id: "u1", role: "user", content: "Monorepo or polyrepo?" },
  { id: "a1", role: "assistant", content: "Monorepo.", model: "model-a", provider: "vendor-a" },
  { id: "u2", role: "user", content: "What about for two teams?" },
  { id: "tool-step", role: "assistant", content: "" },
  { id: "t1", role: "tool", content: "lookup result" },
  { id: "a2", role: "assistant", content: "Still a monorepo.", model: "model-b" },
  { id: "u3", role: "user", content: "Compare that answer with other models and conclude." },
];

describe("resolveComparisonSubject", () => {
  it("pairs a reply with the question it answered, not the compare request", () => {
    const subject = resolveComparisonSubject(messages, "a2");

    expect(subject.question).toBe("What about for two teams?");
    expect(subject.answer).toBe("Still a monorepo.");
    expect(subject.answerModel).toBe("model-b");
  });

  it("carries earlier turns so a follow-up question still makes sense", () => {
    expect(resolveComparisonSubject(messages, "a2").context).toBe(
      "user: Monorepo or polyrepo?\n\nassistant: Monorepo.",
    );
  });

  it("compares an earlier reply without reading turns that came after it", () => {
    const subject = resolveComparisonSubject(messages, "a1");

    expect(subject.question).toBe("Monorepo or polyrepo?");
    expect(subject.context).toBeUndefined();
  });

  it.each([
    ["an unknown message", "missing"],
    ["a user message", "u1"],
    ["an assistant message with no text", "tool-step"],
  ])("refuses %s", (_label, id) => {
    expect(() => resolveComparisonSubject(messages, id)).toThrow("not available to compare");
  });

  it("refuses a reply with no question before it", () => {
    expect(() =>
      resolveComparisonSubject([{ id: "a0", role: "assistant", content: "Hello." }], "a0"),
    ).toThrow("no question");
  });
});

describe("readComparisonConclusion", () => {
  it("reads agreements, disagreements and the conclusion", () => {
    const raw = JSON.stringify({
      agreements: ["A monorepo suits one team."],
      disagreements: [
        {
          point: "When to split",
          positions: [{ model: "Model A", position: "Never for two teams." }],
        },
      ],
      conclusion: "Use a monorepo.",
    });

    expect(readComparisonConclusion(raw)).toEqual(JSON.parse(raw));
  });

  it("keeps the concluded answer when the model ignores the JSON format", () => {
    expect(readComparisonConclusion("Use a monorepo.\n")).toEqual({
      agreements: [],
      disagreements: [],
      conclusion: "Use a monorepo.",
    });
  });
});
