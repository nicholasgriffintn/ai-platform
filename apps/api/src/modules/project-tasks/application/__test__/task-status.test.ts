import { describe, expect, it, vi } from "vitest";

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";

import { ProjectTaskRepository } from "../../infrastructure/ProjectTaskRepository";
import { transitionProjectTask } from "../task-status";

function contextWith(updateTask: ReturnType<typeof vi.fn>) {
  return { repositories: fakeRepositories([[ProjectTaskRepository, { updateTask }]]) } as any;
}

describe("transitionProjectTask", () => {
  it("refuses to reopen a finished task", async () => {
    const updateTask = vi.fn();

    await expect(
      transitionProjectTask(
        contextWith(updateTask),
        { id: "t", status: "cancelled" } as any,
        "review",
      ),
    ).rejects.toThrow("only a person can reopen it");
    expect(updateTask).not.toHaveBeenCalled();
  });

  it("writes only from the status the caller read", async () => {
    const updateTask = vi.fn().mockResolvedValue({ id: "t", status: "blocked" });

    await transitionProjectTask(
      contextWith(updateTask),
      { id: "t", status: "running" } as any,
      "blocked",
    );

    expect(updateTask).toHaveBeenCalledWith(
      "t",
      { status: "blocked" },
      { fromStatuses: ["running"] },
    );
  });

  it("reports a conflict when the task moved first", async () => {
    await expect(
      transitionProjectTask(
        contextWith(vi.fn().mockResolvedValue(null)),
        { id: "t", status: "running" } as any,
        "review",
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
