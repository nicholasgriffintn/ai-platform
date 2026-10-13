import { describe, expect, it } from "vitest";

import { parseEvalCaseLines, parseJudgeScore, scoreDeterministic } from "../index.js";

describe("eval case parsing", () => {
  it("accepts arrow lines and JSON lines, and reports bad JSON by line", () => {
    const parsed = parseEvalCaseLines(
      ["What is 2+2? => 4", '{"input": "Capital of France?", "expected": "Paris"}', "{oops"].join(
        "\n",
      ),
    );

    expect(parsed.cases).toEqual([
      { id: "case-1", input: "What is 2+2?", expected: "4" },
      { id: "case-2", input: "Capital of France?", expected: "Paris" },
    ]);
    expect(parsed.errors).toEqual(["Line 3 is not valid JSON"]);
  });
});

describe("grader scoring", () => {
  it("normalises text for exact and contains, and never throws on a bad pattern", () => {
    expect(scoreDeterministic({ kind: "exact" }, "  Paris \n", "paris")).toBe(1);
    expect(scoreDeterministic({ kind: "contains" }, "It is Paris.", "paris")).toBe(1);
    expect(scoreDeterministic({ kind: "regex", pattern: "(" }, "anything", undefined)).toBe(0);
  });

  it("requires every declared key for JSON graders and a tolerance match for numeric graders", () => {
    expect(
      scoreDeterministic(
        { kind: "json_schema", requiredKeys: ["name", "total"] },
        '{"name":"a","total":3}',
        undefined,
      ),
    ).toBe(1);
    expect(
      scoreDeterministic({ kind: "json_schema", requiredKeys: ["total"] }, "not json", undefined),
    ).toBe(0);
    expect(
      scoreDeterministic({ kind: "numeric", tolerance: 0.01 }, "The answer is 3.14", "3.141"),
    ).toBe(1);
    expect(scoreDeterministic({ kind: "numeric", tolerance: 0.01 }, "About 3", "3.2")).toBe(0);
  });

  it("scores the share of required facts a summary keeps", () => {
    const facts = "14 July\n18%\nNo customer data was lost\n75%";

    expect(
      scoreDeterministic(
        { kind: "fact_coverage" },
        "On 14 July errors peaked at 18%. No customer data was lost.",
        facts,
      ),
    ).toBe(0.75);
    expect(scoreDeterministic({ kind: "fact_coverage" }, "Anything", undefined)).toBe(0);
  });

  it("scores the share of a summary's numbers that appear in the source", () => {
    const source = "Revenue was 4,200,000 euros in Q2, up 18% from 3.5 million.";

    expect(
      scoreDeterministic(
        { kind: "grounded_numbers" },
        "Revenue reached 4200000 euros, up 18%.",
        undefined,
        source,
      ),
    ).toBe(1);
    expect(
      scoreDeterministic(
        { kind: "grounded_numbers" },
        "Up 18%, with 25 new hires.",
        undefined,
        source,
      ),
    ).toBe(0.5);
    expect(
      scoreDeterministic({ kind: "grounded_numbers" }, "Revenue grew.", undefined, source),
    ).toBe(1);
  });

  it("maps judge scores onto zero to one", () => {
    expect(parseJudgeScore('{"score": 5, "reason": "great"}')).toBe(1);
    expect(parseJudgeScore("I'd give it 2/5")).toBe(0.25);
    expect(parseJudgeScore("no idea")).toBeNull();
  });
});
