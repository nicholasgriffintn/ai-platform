import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { renderDependencyHandoffs, selectReleasableDependents } from "../dependents";

function task(overrides: Partial<ProjectTask> & Pick<ProjectTask, "id">): ProjectTask {
  return {
    projectId: "project-1",
    workspaceId: "workspace-1",
    objective: `Objective ${overrides.id}`,
    acceptanceCriteria: [],
    expectedOutput: null,
    context: null,
    constraints: null,
    dependsOnTaskIds: [],
    requireApprovalFor: [],
    status: "backlog",
    source: "user",
    blockedReason: null,
    blockedDetail: null,
    stageId: null,
    runner: null,
    createdByUserId: 7,
    assigneeUserId: null,
    runnerIdentityUserId: null,
    conversationId: null,
    originConversationId: null,
    goalId: null,
    dispatchTaskId: null,
    completions: [],
    position: 1000,
    tokenBudget: null,
    tokensSpent: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: null,
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

function waiting(id: string, dependsOnTaskIds: string[], position = 1000): ProjectTask {
  return task({
    id,
    dependsOnTaskIds,
    position,
    status: "blocked",
    blockedReason: "dependencies_unmet",
    runnerIdentityUserId: 7,
  });
}

function completion(output: string): ProjectTask["completions"][number] {
  return {
    id: "completion-1",
    stageId: null,
    conversationId: "task_upstream",
    goalId: "goal-1",
    output,
    evidence: [],
    approval: { mode: "human", status: "approved", reviewedByUserId: 7, reviewedAt: null },
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("selectReleasableDependents", () => {
  it("releases a join only once every dependency is done", () => {
    const security = task({ id: "security", status: "done" });
    const tests = task({ id: "tests", status: "running" });
    const review = waiting("review", ["security", "tests"]);

    expect(selectReleasableDependents([security, tests, review], 3)).toEqual([]);
    expect(
      selectReleasableDependents([security, { ...tests, status: "done" }, review], 3).map(
        (released) => released.id,
      ),
    ).toEqual(["review"]);
  });

  it("fills only the free slots, in board order", () => {
    const scope = task({ id: "scope", status: "done" });
    const later = waiting("later", ["scope"], 3000);
    const first = waiting("first", ["scope"], 1000);
    const second = waiting("second", ["scope"], 2000);

    expect(
      selectReleasableDependents([scope, later, first, second], 2).map((released) => released.id),
    ).toEqual(["first", "second"]);
    expect(selectReleasableDependents([scope, first], 0)).toEqual([]);
  });

  it("leaves tasks nobody asked to start", () => {
    const scope = task({ id: "scope", status: "done" });
    const planned = task({ id: "planned", dependsOnTaskIds: ["scope"] });
    const unclaimed = { ...waiting("unclaimed", ["scope"]), runnerIdentityUserId: null };
    const failed = { ...waiting("failed", ["scope"]), blockedReason: "run_failed" as const };

    expect(selectReleasableDependents([scope, planned, unclaimed, failed], 3)).toEqual([]);
  });
});

describe("renderDependencyHandoffs", () => {
  it("hands over the latest output of finished dependencies only", () => {
    const handoffs = renderDependencyHandoffs([
      task({
        id: "done",
        status: "done",
        completions: [completion("first draft"), completion("final findings")],
      }),
      task({ id: "review", status: "review", completions: [completion("unaccepted work")] }),
    ]);

    expect(handoffs).toHaveLength(1);
    expect(handoffs[0]).toContain("final findings");
    expect(handoffs[0]).toContain("untrusted reference material");
    expect(handoffs[0]).not.toContain("first draft");
  });

  it("says when a long handoff was cut short", () => {
    const [handoff] = renderDependencyHandoffs([
      task({ id: "long", status: "done", completions: [completion("x".repeat(9000))] }),
    ]);

    expect(handoff).toContain("Open the upstream task for the full output.");
  });
});
