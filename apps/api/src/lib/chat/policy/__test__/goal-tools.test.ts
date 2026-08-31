import { describe, expect, it } from "vitest";

import { mergeEnabledGoalToolNames } from "../goal-tools";
import { resolveTurnStepBudget } from "../step-budget";

describe("mergeEnabledGoalToolNames", () => {
  it("keeps goal completion available when a goal is created during the turn", () => {
    expect(mergeEnabledGoalToolNames({ isProUser: true })).toEqual(["set_goal", "complete_goal"]);
  });

  it("keeps the tools the request already enabled without duplicating them", () => {
    expect(
      mergeEnabledGoalToolNames({
        enabledTools: ["web_search", "set_goal"],
        isProUser: true,
      }),
    ).toEqual(["web_search", "set_goal", "complete_goal"]);
  });

  it("offers nothing to a free user", () => {
    expect(mergeEnabledGoalToolNames({ enabledTools: ["web_search"] })).toEqual(["web_search"]);
  });
});

describe("goal turn step budget", () => {
  const options = { context: { user: { id: 1, plan_id: "pro" } } } as never;

  it("gives a goal-driven turn room to work past the ordinary chat ceiling", () => {
    expect(resolveTurnStepBudget(options, "chat", { hasActiveGoal: true })).toBeGreaterThan(
      resolveTurnStepBudget(options, "chat"),
    );
  });

  it("still honours a step ceiling the request set for itself", () => {
    const capped = { ...(options as any), max_steps: 3 } as never;

    expect(resolveTurnStepBudget(capped, "chat", { hasActiveGoal: true })).toBe(3);
  });
});
