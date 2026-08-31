import { describe, expect, it } from "vitest";

import { createPublicTaskRequestSchema } from "./tasks";

describe("task scheduling", () => {
  it("normalises offset timestamps to canonical UTC ISO", () => {
    const parsed = createPublicTaskRequestSchema.parse({
      task_type: "memory_synthesis",
      task_data: {},
      schedule_type: "scheduled",
      scheduled_at: "2026-08-31T18:30:00+01:00",
    });

    expect(parsed.scheduled_at).toBe("2026-08-31T17:30:00.000Z");
  });

  it("rejects non-ISO schedule timestamps", () => {
    expect(() =>
      createPublicTaskRequestSchema.parse({
        task_type: "memory_synthesis",
        task_data: {},
        schedule_type: "scheduled",
        scheduled_at: "31 August 2026 18:30",
      }),
    ).toThrow();
  });
});
