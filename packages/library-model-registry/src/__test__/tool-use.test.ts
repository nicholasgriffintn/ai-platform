import { describe, expect, it } from "vitest";

import {
  findMonotoneFailure,
  findToolUseRegressions,
  gradeToolUse,
  matchesToolArgs,
  resolveToolUseCaseVerdict,
} from "../tool-use.js";

const call = (tool: string, args: Record<string, unknown> = {}) => ({ tool, args });

describe("tool argument matching", () => {
  it("matches substrings case-insensitively, including inside non-string values", () => {
    expect(matchesToolArgs({ query: "~PARIS" }, { query: "weather in paris" })).toBe(true);
    expect(matchesToolArgs({ filters: "~draft" }, { filters: { status: "Draft" } })).toBe(true);
    expect(matchesToolArgs({ query: "~rome" }, { query: "weather in paris" })).toBe(false);
    expect(matchesToolArgs({ query: "~paris" }, {})).toBe(false);
  });

  it("compares numeric bounds against numbers and array lengths only", () => {
    expect(matchesToolArgs({ limit: "<=5" }, { limit: 5 })).toBe(true);
    expect(matchesToolArgs({ limit: "<=5" }, { limit: 6 })).toBe(false);
    expect(matchesToolArgs({ questions: ">=2" }, { questions: [{}, {}] })).toBe(true);
    expect(matchesToolArgs({ limit: ">=1" }, { limit: "3" })).toBe(false);
  });

  it("treats null as a required absence and reaches nested fields through dotted keys", () => {
    expect(matchesToolArgs({ operation: null }, { provider: "gmail" })).toBe(true);
    expect(matchesToolArgs({ operation: null }, { operation: "send" })).toBe(false);
    expect(
      matchesToolArgs({ "questions.0.prompt": "~which" }, { questions: [{ prompt: "Which?" }] }),
    ).toBe(true);
    expect(matchesToolArgs({ "input.url": "~example" }, { input: { url: "https://x.test" } })).toBe(
      false,
    );
  });

  it("matches arrays as unordered subsets and objects as partial matches", () => {
    expect(matchesToolArgs({ tags: ["b"] }, { tags: ["a", "b"] })).toBe(true);
    expect(matchesToolArgs({ tags: ["c"] }, { tags: ["a", "b"] })).toBe(false);
    expect(matchesToolArgs({ input: { kind: "skill" } }, { input: { kind: "skill", x: 1 } })).toBe(
      true,
    );
    expect(matchesToolArgs({ count: 2 }, { count: "2" })).toBe(false);
  });
});

describe("trajectory grading", () => {
  it("orders first occurrences, so starting the work before loading its skill fails", () => {
    const order = [{ tool: "load_skill" }, { tool: "research" }];

    expect(
      gradeToolUse(
        { order },
        {
          calls: [call("research"), call("load_skill"), call("research")],
          texts: [],
          finalText: "",
        },
      ).passed,
    ).toBe(false);
    expect(
      gradeToolUse({ order }, { calls: [call("load_skill")], texts: [], finalText: "" }).failures,
    ).toEqual([{ check: "order", detail: "research was out of order" }]);
  });

  it("requires calls in order without demanding adjacency", () => {
    const trajectory = {
      calls: [call("discover_capabilities"), call("get_weather"), call("use_recipe_connector")],
      texts: [],
      finalText: "",
    };

    expect(
      gradeToolUse(
        { order: [{ tool: "discover_capabilities" }, { tool: "use_recipe_connector" }] },
        trajectory,
      ).passed,
    ).toBe(true);
    expect(
      gradeToolUse(
        { order: [{ tool: "use_recipe_connector" }, { tool: "discover_capabilities" }] },
        trajectory,
      ).failures,
    ).toEqual([{ check: "order", detail: "discover_capabilities was out of order" }]);
  });

  it("reports every failed check and separates final-text checks from all-text checks", () => {
    const grade = gradeToolUse(
      {
        calls: [{ tool: "load_skill", args: { name: "~deck" } }],
        minCalls: 2,
        textMust: ["draft"],
        finalTextMust: ["approve"],
      },
      {
        calls: [call("load_skill", { name: "slides" })],
        texts: ["A draft", "Done"],
        finalText: "Done",
      },
    );

    expect(grade.passed).toBe(false);
    expect(grade.failures.map((failure) => failure.check)).toEqual([
      "calls",
      "minCalls",
      "finalTextMust",
    ]);
  });
});

describe("early failure", () => {
  it("fails as soon as a forbidden call, extra call or forbidden phrase appears", () => {
    const expect_ = {
      callsMustNot: [{ tool: "use_recipe_connector", args: { operation: "~send" } }],
      maxCalls: 2,
      textMustNot: ["password"],
    };

    expect(
      findMonotoneFailure(expect_, {
        calls: [call("use_recipe_connector", { provider: "gmail" })],
        texts: [],
        finalText: "",
      }),
    ).toBeNull();
    expect(
      findMonotoneFailure(expect_, {
        calls: [call("use_recipe_connector", { operation: "gmail_send_email" })],
        texts: [],
        finalText: "",
      })?.check,
    ).toBe("callsMustNot");
    expect(
      findMonotoneFailure(expect_, {
        calls: [call("a"), call("b"), call("c")],
        texts: [],
        finalText: "",
      })?.check,
    ).toBe("maxCalls");
    expect(
      findMonotoneFailure(expect_, {
        calls: [],
        texts: ["Send me your Password"],
        finalText: "",
      })?.check,
    ).toBe("textMustNot");
  });

  it("never fails early on checks that a later step could still satisfy", () => {
    expect(
      findMonotoneFailure(
        { calls: [{ tool: "ask_user" }], minCalls: 1, finalTextMust: ["done"] },
        { calls: [], texts: [], finalText: "" },
      ),
    ).toBeNull();
  });
});

describe("sample voting and baselines", () => {
  it("asks for a tie-break only when samples split evenly", () => {
    expect(resolveToolUseCaseVerdict([true, true])).toEqual({ passed: true, needsTieBreak: false });
    expect(resolveToolUseCaseVerdict([true, false])).toEqual({
      passed: false,
      needsTieBreak: true,
    });
    expect(resolveToolUseCaseVerdict([true, false, true])).toEqual({
      passed: true,
      needsTieBreak: false,
    });
  });

  it("counts only cases that passed in the baseline and fail now", () => {
    expect(
      findToolUseRegressions(
        new Map([
          ["a", false],
          ["b", false],
          ["c", true],
        ]),
        new Map([
          ["a", true],
          ["c", false],
        ]),
      ),
    ).toEqual(["a"]);
  });
});
