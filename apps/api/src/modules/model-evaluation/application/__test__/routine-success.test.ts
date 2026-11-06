import { describe, expect, it } from "vitest";

import type { RoutineOutcomeSummaryRow } from "../../infrastructure/RoutineOutcomeRepository";
import { formatRoutineSuccess } from "../routine-success";

const row: RoutineOutcomeSummaryRow = {
  routine_id: "installation-1",
  routine_kind: "recipe",
  runs: 10,
  verified: 6,
  unverified: 3,
  failed: 1,
  false_completions: 0,
  last_status: "verified",
  last_run_at: "2026-11-05T10:00:00.000Z",
};

describe("formatRoutineSuccess", () => {
  it("does not count unverified runs as successes", () => {
    expect(formatRoutineSuccess(row).successRate).toBe(0.6);
  });

  it("takes a verified run a person sent back out of the successes", () => {
    expect(formatRoutineSuccess({ ...row, false_completions: 2 })).toMatchObject({
      verified: 4,
      falseCompletions: 2,
      successRate: 0.4,
    });
  });
});
