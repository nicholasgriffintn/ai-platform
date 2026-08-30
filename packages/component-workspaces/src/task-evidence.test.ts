import { describe, expect, it } from "vitest";

import { isTaskCriterionMet } from "./task-evidence";

describe("isTaskCriterionMet", () => {
  it("shows criteria as met when completed work is awaiting approval", () => {
    expect(isTaskCriterionMet("review", "The release note is ready", [])).toBe(true);
  });

  it("does not claim unfinished work met a criterion without matching evidence", () => {
    expect(isTaskCriterionMet("running", "The release note is ready", [])).toBe(false);
  });

  it("compares punctuation-heavy claims without unbounded backtracking", () => {
    const claim = `The release note is ready${"!".repeat(50_000)}x`;

    expect(
      isTaskCriterionMet("running", claim, [
        {
          claim,
          route: "Reviewed the release note",
          evidence_surface: "Task conversation",
          status: "confirmed",
        },
      ]),
    ).toBe(true);
  }, 100);
});
