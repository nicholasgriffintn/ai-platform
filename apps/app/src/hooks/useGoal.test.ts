import { describe, expect, it } from "vitest";

import { goalRefetchInterval } from "./useGoal";

describe("goalRefetchInterval", () => {
  it("keeps checking while a background run owns an active goal", () => {
    expect(goalRefetchInterval({ status: "active" })).toBe(2_000);
  });

  it("stops when the goal is no longer active", () => {
    expect(goalRefetchInterval({ status: "completed" })).toBe(false);
    expect(goalRefetchInterval(null)).toBe(false);
  });
});
