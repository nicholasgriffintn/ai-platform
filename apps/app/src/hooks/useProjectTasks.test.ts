import { describe, expect, it } from "vitest";

import { projectTasksRefetchInterval } from "./useProjectTasks";

describe("projectTasksRefetchInterval", () => {
  it("refreshes queued and running work promptly", () => {
    expect(projectTasksRefetchInterval([{ status: "queued" }])).toBe(2_000);
    expect(projectTasksRefetchInterval([{ status: "running" }])).toBe(2_000);
  });

  it("backs off when the board is stable", () => {
    expect(projectTasksRefetchInterval([{ status: "review" }])).toBe(30_000);
  });
});
