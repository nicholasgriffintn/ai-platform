import { describe, expect, it } from "vitest";

import { projectTasksRefetchInterval } from "./useProjectTasks";

describe("projectTasksRefetchInterval", () => {
  it("refreshes queued and running work promptly", () => {
    expect(projectTasksRefetchInterval([{ status: "queued", blockedReason: null }])).toBe(2_000);
    expect(projectTasksRefetchInterval([{ status: "running", blockedReason: null }])).toBe(2_000);
    expect(
      projectTasksRefetchInterval([{ status: "blocked", blockedReason: "awaiting_input" }]),
    ).toBe(2_000);
    expect(
      projectTasksRefetchInterval([{ status: "blocked", blockedReason: "awaiting_approval" }]),
    ).toBe(2_000);
  });

  it("backs off when the board is stable", () => {
    expect(projectTasksRefetchInterval([{ status: "review", blockedReason: null }])).toBe(30_000);
    expect(projectTasksRefetchInterval([{ status: "blocked", blockedReason: "run_failed" }])).toBe(
      30_000,
    );
  });
});
