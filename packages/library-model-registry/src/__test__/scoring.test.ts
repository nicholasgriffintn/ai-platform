import { describe, expect, it } from "vitest";

import { parseEvalCaseLines, parseJudgeScore, scoreDeterministic } from "../index.js";

describe("eval scoring", () => {
  it("parses arrow and JSON case lines and reports bad ones", () => {
    const parsed = parseEvalCaseLines(
      [
        "What is 2 + 2? => 4",
        '{"input": "Capital of France?", "expected": "Paris"}',
        "",
        '{"prompt": "missing input"}',
        "Open-ended question",
      ].join("\n"),
    );

    expect(parsed.cases).toEqual([
      { id: "case-1", input: "What is 2 + 2?", expected: "4" },
      { id: "case-2", input: "Capital of France?", expected: "Paris" },
      { id: "case-4", input: "Open-ended question", expected: undefined },
    ]);
    expect(parsed.errors).toEqual(['Line 3 needs an "input" string']);
  });

  it("normalises whitespace and case for deterministic scorers and survives bad regex", () => {
    expect(scoreDeterministic({ type: "exact", metric: "m" }, "  Paris \n", "paris")).toBe(1);
    expect(scoreDeterministic({ type: "contains", metric: "m" }, "It is Paris.", "paris")).toBe(1);
    expect(
      scoreDeterministic({ type: "regex", metric: "m", pattern: "(" }, "anything", undefined),
    ).toBe(0);
  });

  it("maps judge replies onto 0–1 and rejects replies without a score", () => {
    expect(parseJudgeScore('{"score": 5, "reason": "great"}')).toBe(1);
    expect(parseJudgeScore("I'd give it 2/5")).toBe(0.25);
    expect(parseJudgeScore("no idea")).toBeNull();
  });
});
