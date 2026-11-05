import type { WorkspaceTeamPlan } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { summariseTeamPlan } from "./team-plan-summary";

function plan(credits: Partial<WorkspaceTeamPlan["pool"]["credits"]>, available = 1) {
  return {
    seats: { limit: 3, occupied: 3 - available, available },
    pool: {
      period: "2026-11",
      resetsAt: "2026-12-01T00:00:00.000Z",
      credits: {
        included: 100,
        used: 0,
        reserved: 0,
        grace: 0,
        overrun: 0,
        overage: 0,
        overage_enabled: false,
        state: "ok" as const,
        ...credits,
      },
    },
  };
}

describe("summariseTeamPlan", () => {
  it("counts credits held by running work as already gone", () => {
    expect(summariseTeamPlan(plan({ used: 40, reserved: 20, grace: 10 }))).toMatchObject({
      remainingCredits: 50,
    });
  });

  it("never shows a negative balance after an overrun", () => {
    expect(summariseTeamPlan(plan({ used: 130 }))).toMatchObject({
      remainingCredits: 0,
      committedRatio: 1,
    });
  });

  it("reports the seats as full when none are available", () => {
    expect(summariseTeamPlan(plan({}, 0)).seatsFull).toBe(true);
    expect(summariseTeamPlan(plan({}, 1)).seatsFull).toBe(false);
  });
});
