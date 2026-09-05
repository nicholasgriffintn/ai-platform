import { describe, expect, it } from "vitest";

import type { Task } from "~/lib/database/schema";

import { presentPublicTask } from "../task-presentation";

describe("public task presentation", () => {
  it("never exposes durable execution authority", () => {
    const task = {
      id: "task-1",
      execution_owner_token: "secret-owner-token",
      execution_lease_expires_at: "2026-09-05T12:05:00.000Z",
    } as Task;

    expect(presentPublicTask(task)).toEqual({ id: "task-1" });
  });
});
