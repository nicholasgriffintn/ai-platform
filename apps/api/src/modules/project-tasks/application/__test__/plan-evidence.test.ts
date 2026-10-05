import { createSequentialProjectFlow } from "@ngriffin_uk/polychat-schemas";
import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import type { OutputRecord } from "~/modules/outputs/infrastructure/OutputRepository";

import {
  task,
  projectTaskEvidenceRun as run,
} from "../../../../../test/project-task-evidence-fixtures";
import { buildProjectTaskPlanEvidence, getProjectTaskResumeCapability } from "../plan-evidence";

describe("project task plan evidence", () => {
  it.each(["blocked", "cancelled"] as const)(
    "retains completed evidence and durable outputs when the plan is %s",
    (status) => {
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
        task: { ...task, status },
        flow: createSequentialProjectFlow(
          [
            {
              id: "plan",
              name: "Plan",
              instructions: null,
              teammateId: null,
              skillIds: [],
              mode: null,
              requiresApprovalFor: [],
            },
            {
              id: "build",
              name: "Build",
              instructions: null,
              teammateId: null,
              skillIds: [],
              mode: null,
              requiresApprovalFor: [],
            },
            {
              id: "publish",
              name: "Publish",
              instructions: null,
              teammateId: null,
              skillIds: [],
              mode: null,
              requiresApprovalFor: [],
            },
          ],
          ["build", "publish"],
        ),
        runs: [run("run-1", "plan", "succeeded"), run("run-2", "build", "failed")],
        outputs: [output],
        unsafeRunIds: new Set(),
      });

      expect(evidence.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ flowNodeId: "plan", status: "completed" }),
          expect.objectContaining({
            flowNodeId: "build",
            status: "failed",
            outputs: [expect.objectContaining({ id: "output-1" })],
          }),
          expect.objectContaining({
            flowNodeId: "publish",
            status: status === "cancelled" ? "abandoned" : "proposed",
            attempts: [],
          }),
        ]),
      );
    },
  );

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
          nodeId: "build",
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
            reviewWaitId: null,
            reviewedAt: "2026-09-05T10:05:00.000Z",
          },
          createdAt: "2026-09-05T10:05:00.000Z",
        },
      ],
      completedAt: "2026-09-05T10:05:00.000Z",
    };

    const evidence = buildProjectTaskPlanEvidence({
      task: resumedTask,
      flow: createSequentialProjectFlow(
        [
          {
            id: "build",
            name: "Build",
            instructions: null,
            teammateId: null,
            skillIds: [],
            mode: null,
            requiresApprovalFor: [],
          },
        ],
        [],
      ),
      runs: [run("run-2", "build", "interrupted"), run("run-3", "build", "succeeded", 2)],
      outputs: [],
      unsafeRunIds: new Set(),
    });

    expect(evidence.nodes[0]).toMatchObject({
      flowNodeId: "build",
      status: "completed",
      attempts: [
        { runId: "run-2", attempt: 1, status: "interrupted", completionIds: [] },
        { runId: "run-3", attempt: 2, status: "succeeded", completionIds: ["completion-2"] },
      ],
    });
  });
});
