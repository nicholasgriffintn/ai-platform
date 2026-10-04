import { describe, expect, it } from "vitest";

import { withDecisionCorrections } from "../decision-policy.js";

const corrections = [
  { recommended: "require_approval", corrected: "allow", summary: "Sent a draft" },
];

describe("withDecisionCorrections", () => {
  it("shows prior corrections to the model alongside the judged state", () => {
    expect(withDecisionCorrections({ request: "send it" }, corrections)).toEqual({
      request: "send it",
      priorCorrections: [
        { recommended: "require_approval", corrected: "allow", summary: "Sent a draft" },
      ],
    });
  });

  it("leaves the state untouched when there is nothing to learn from", () => {
    const state = { request: "send it" };

    expect(withDecisionCorrections(state, [])).toBe(state);
    expect(withDecisionCorrections(state, undefined)).toBe(state);
  });

  it("cannot corrupt a string or array state", () => {
    expect(withDecisionCorrections("plain text", corrections)).toBe("plain text");
    expect(withDecisionCorrections(["a", "b"], corrections)).toEqual(["a", "b"]);
  });
});
