import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { getProjectTaskResumeCapability } from "../plan-evidence";

const task = {
  id: "task-1",
  projectId: "project-1",
  workspaceId: "workspace-1",
  key: null,
  number: null,
  kind: "task",
  description: null,
  priority: "none",
  parentTaskId: null,
  startAt: null,
  dueAt: null,
  owner: null,
  reviewer: null,
  details: {},
  objective: "Ship the report",
  acceptanceCriteria: [{ id: "criterion-1", text: "Report exists" }],
  assumptions: [],
  killConditions: [],
  retrospective: null,
  expectedOutput: null,
  context: null,
  constraints: null,
  dependsOnTaskIds: [],
  requireApprovalFor: [],
  status: "blocked",
  source: "user",
  blockedReason: "run_failed",
  blockedDetail: "Provider failed",
  runId: "run-2",
  dispatchTaskId: null,
  stageId: "build",
  flowSnapshot: null,
  runner: null,
  createdByUserId: 7,
  assigneeUserId: null,
  runnerIdentityUserId: 7,
  conversationId: "conversation-run-2",
  goalId: "goal-2",
  completions: [
    {
      id: "completion-1",
      stageId: "plan",
      conversationId: "conversation-1",
      goalId: "goal-1",
      runId: "run-1",
      output: "Plan ready",
      evidence: [],
      approval: {
        mode: "automated",
        status: "approved",
        reviewedByUserId: null,
        reviewedAt: "2026-09-05T10:01:00.000Z",
      },
      createdAt: "2026-09-05T10:01:00.000Z",
    },
  ],
  position: 1000,
  tokenBudget: 1000,
  tokensSpent: 100,
  createdAt: "2026-09-05T09:00:00.000Z",
  updatedAt: "2026-09-05T10:01:00.000Z",
  startedAt: "2026-09-05T10:00:00.000Z",
  completedAt: null,
} satisfies ProjectTask;

describe("project task plan evidence", () => {
  it("blocks blind stage retry after a consumed external operation", () => {
    expect(getProjectTaskResumeCapability(task, new Set(["run-2"]))).toEqual({
      supported: false,
      reason: expect.stringContaining("Reconcile the provider"),
    });
    expect(getProjectTaskResumeCapability(task, new Set())).toEqual({
      supported: true,
      reason: null,
    });
  });
});
