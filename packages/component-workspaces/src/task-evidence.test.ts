import { describe, expect, it } from "vitest";

import { isTaskCriterionMet } from "./task-evidence";

describe("isTaskCriterionMet", () => {
  it("shows criteria as met when completed work is awaiting approval", () => {
    expect(isTaskCriterionMet("review", "The release note is ready", [])).toBe(true);
  });

  it("does not claim unfinished work met a criterion without matching evidence", () => {
    expect(isTaskCriterionMet("running", "The release note is ready", [])).toBe(false);
  });
});
