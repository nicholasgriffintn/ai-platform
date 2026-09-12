import { describe, expect, it } from "vitest";

import { resolveSandboxTaskProfile } from "./sandbox-task-profile";

describe("resolveSandboxTaskProfile", () => {
  it("keeps implementation tasks writable and commit-aware", () => {
    expect(
      resolveSandboxTaskProfile({
        task: "Add a logout button",
        taskType: "feature-implementation",
        shouldCommit: true,
      }),
    ).toMatchObject({
      taskType: "feature-implementation",
      task: "Add a logout button",
      shouldCommit: true,
      readOnlyCommands: false,
    });
  });

  it.each(["code-review", "test-suite"] as const)(
    "forces %s tasks to read-only mode",
    (taskType) => {
      const profile = resolveSandboxTaskProfile({
        task: "Inspect the requested repository behaviour",
        taskType,
        shouldCommit: true,
      });

      expect(profile.taskType).toBe(taskType);
      expect(profile.deliveryPolicy).toEqual({ mode: "leave_uncommitted" });
      expect(profile.shouldCommit).toBe(false);
      expect(profile.readOnlyCommands).toBe(true);
      expect(profile.task).toContain("Do not modify files");
    },
  );

  it.each([
    ["bug-fix", "Bug report:"],
    ["refactoring", "Refactoring scope:"],
    ["documentation", "Documentation request:"],
    ["migration", "Migration scope:"],
  ] as const)("applies the shared %s task instructions", (taskType, instruction) => {
    const profile = resolveSandboxTaskProfile({
      task: "Make the requested change",
      taskType,
      shouldCommit: true,
    });

    expect(profile.taskType).toBe(taskType);
    expect(profile.shouldCommit).toBe(true);
    expect(profile.readOnlyCommands).toBe(false);
    expect(profile.task).toContain(instruction);
  });
});
