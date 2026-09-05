import type { ChatRun, ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import type { OutputRecord } from "~/repositories/OutputRepository";

import { buildProjectTaskPlanEvidence, getProjectTaskResumeCapability } from "../plan-evidence";

const task = {
  id: "task-1",
  projectId: "project-1",
  workspaceId: "workspace-1",
  objective: "Ship the report",
  acceptanceCriteria: [{ id: "criterion-1", text: "Report exists" }],
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

function run(id: string, stageId: string, status: ChatRun["status"], attempt = 1): ChatRun {
  return {
    protocolVersion: 1,
    id,
    conversationId: `conversation-${id}`,
    projectId: "project-1",
    projectTaskId: "task-1",
    stageId,
    initiatorUserId: 7,
    status,
    attempt,
    createdAt: "2026-09-05T10:00:00.000Z",
    updatedAt: "2026-09-05T10:01:00.000Z",
    startedAt: "2026-09-05T10:00:00.000Z",
    completedAt: "2026-09-05T10:01:00.000Z",
    terminalReason: status === "failed" ? "Provider failed" : null,
    lastMessageId: null,
    context: null,
    retry: null,
  };
}

describe("project task plan evidence", () => {
  it("derives stage state only from exact attempts and links their durable outputs", () => {
    const output = {
      id: "output-1",
      created_by_user_id: 7,
      project_id: "project-1",
      conversation_id: "conversation-run-2",
      parent_output_id: null,
      capability_id: "articles",
      group_id: null,
      title: "Report",
      kind: "report",
      status: "ready",
      sensitivity: "internal",
      content: JSON.stringify({ body: "Report" }),
      storage_key: null,
      mime_type: null,
      filename: null,
      byte_size: null,
      revision: 1,
      provenance_json: JSON.stringify({
        protocolVersion: 1,
        capturedAt: "2026-09-05T10:01:00.000Z",
        completeness: "partial",
        origin: "generated",
        run: { id: "run-2", attempt: 1 },
        model: null,
        skills: [],
        sources: [],
        approvals: [],
      }),
      created_at: "2026-09-05T10:01:00.000Z",
      updated_at: null,
    } satisfies OutputRecord;
    const evidence = buildProjectTaskPlanEvidence({
      task,
      flow: {
        stages: [
          {
            id: "plan",
            name: "Plan",
            instructions: null,
            agentId: null,
            skillIds: [],
            mode: null,
            requiresApprovalFor: [],
            advance: "on_goal_complete",
          },
          {
            id: "build",
            name: "Build",
            instructions: null,
            agentId: null,
            skillIds: [],
            mode: null,
            requiresApprovalFor: [],
            advance: "on_human_accept",
          },
          {
            id: "publish",
            name: "Publish",
            instructions: null,
            agentId: null,
            skillIds: [],
            mode: null,
            requiresApprovalFor: [],
            advance: "on_human_accept",
          },
        ],
      },
      runs: [run("run-1", "plan", "succeeded"), run("run-2", "build", "failed")],
      outputs: [output],
      unsafeRunIds: new Set(),
    });

    expect(evidence.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ flowStageId: "plan", status: "completed" }),
        expect.objectContaining({
          flowStageId: "build",
          status: "failed",
          outputs: [expect.objectContaining({ id: "output-1" })],
        }),
        expect.objectContaining({ flowStageId: "publish", status: "proposed", attempts: [] }),
      ]),
    );
  });

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

  it("retains interrupted and resumed attempts at the same stage boundary", () => {
    const resumedTask: ProjectTask = {
      ...task,
      status: "done",
      blockedReason: null,
      blockedDetail: null,
      runId: "run-3",
      completions: [
        ...task.completions,
        {
          id: "completion-2",
          stageId: "build",
          conversationId: "conversation-run-3",
          goalId: "goal-3",
          runId: "run-3",
          runAttempt: 2,
          output: "Report ready",
          evidence: [],
          approval: {
            mode: "automated",
            status: "approved",
            reviewedByUserId: null,
            reviewedAt: "2026-09-05T10:05:00.000Z",
          },
          createdAt: "2026-09-05T10:05:00.000Z",
        },
      ],
      completedAt: "2026-09-05T10:05:00.000Z",
    };

    const evidence = buildProjectTaskPlanEvidence({
      task: resumedTask,
      flow: {
        stages: [
          {
            id: "build",
            name: "Build",
            instructions: null,
            agentId: null,
            skillIds: [],
            mode: null,
            requiresApprovalFor: [],
            advance: "on_goal_complete",
          },
        ],
      },
      runs: [run("run-2", "build", "interrupted"), run("run-3", "build", "succeeded", 2)],
      outputs: [],
      unsafeRunIds: new Set(),
    });

    expect(evidence.stages[0]).toMatchObject({
      flowStageId: "build",
      status: "completed",
      attempts: [
        { runId: "run-2", attempt: 1, status: "interrupted", completionIds: [] },
        { runId: "run-3", attempt: 2, status: "succeeded", completionIds: ["completion-2"] },
      ],
    });
  });
});
