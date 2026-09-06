import type { ChatRun, Goal, ProjectFlowStage } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  approveLatestProjectTaskCompletion,
  createProjectTaskCompletion,
  projectTaskStatusAfterCompletedGoal,
} from "../completions";

const goal: Goal = {
  id: "goal-1",
  conversation_id: "conversation-1",
  sandbox_run_id: null,
  user_id: 1,
  objective: "Prepare the release note",
  status: "completed",
  source: "user",
  iteration_count: 1,
  stall_streak: 0,
  tokens_spent: 100,
  progress: [],
  evidence: [],
  stopped_reason: null,
  created_at: "2026-08-30T10:00:00.000Z",
  updated_at: null,
  completed_at: "2026-08-30T10:01:00.000Z",
  last_continued_at: null,
};

function stage(advance: ProjectFlowStage["advance"]): ProjectFlowStage {
  return {
    id: "review",
    name: "Review",
    instructions: null,
    agentId: null,
    skillIds: [],
    mode: null,
    requiresApprovalFor: [],
    advance,
  };
}

describe("project task completions", () => {
  it("stores a human approval job for a human-gated stage", () => {
    const completion = createProjectTaskCompletion({
      stage: stage("on_human_accept"),
      conversationId: "conversation-1",
      goal,
      output: "Release note ready for review.",
      createdAt: "2026-08-30T10:01:00.000Z",
    });

    expect(completion).toMatchObject({
      stageId: "review",
      output: "Release note ready for review.",
      approval: { mode: "human", status: "pending" },
    });
  });

  it("retains the exact run attempt, dispatch and durable outputs", () => {
    const run = {
      protocolVersion: 1,
      id: "run-1",
      conversationId: "conversation-1",
      projectId: "project-1",
      projectTaskId: "task-1",
      stageId: "review",
      initiatorUserId: 1,
      status: "succeeded",
      attempt: 2,
      createdAt: "2026-08-30T10:00:00.000Z",
      updatedAt: "2026-08-30T10:01:00.000Z",
      startedAt: "2026-08-30T10:00:00.000Z",
      completedAt: "2026-08-30T10:01:00.000Z",
      terminalReason: null,
      lastMessageId: "message-1",
    } satisfies ChatRun;

    expect(
      createProjectTaskCompletion({
        stage: stage("on_human_accept"),
        conversationId: "conversation-1",
        goal,
        run,
        dispatchTaskId: "dispatch-1",
        outputIds: ["output-1"],
        output: "Ready.",
      }),
    ).toMatchObject({
      runId: "run-1",
      runAttempt: 2,
      dispatchTaskId: "dispatch-1",
      outputIds: ["output-1"],
    });
  });

  it("records automatic approval for an automatically advancing stage", () => {
    const completion = createProjectTaskCompletion({
      stage: stage("on_goal_complete"),
      conversationId: "conversation-1",
      goal,
      output: "Plan complete.",
      createdAt: "2026-08-30T10:01:00.000Z",
    });

    expect(completion.approval).toEqual({
      mode: "automated",
      status: "approved",
      reviewedByUserId: null,
      reviewedAt: "2026-08-30T10:01:00.000Z",
    });
  });

  it("records the person who approves the latest pending completion", () => {
    const pending = createProjectTaskCompletion({
      stage: stage("on_human_accept"),
      conversationId: "conversation-1",
      goal,
      output: "Ready.",
      createdAt: "2026-08-30T10:01:00.000Z",
    });

    expect(
      approveLatestProjectTaskCompletion([pending], 42, "2026-08-30T10:02:00.000Z")[0].approval,
    ).toEqual({
      mode: "human",
      status: "approved",
      reviewedByUserId: 42,
      reviewedAt: "2026-08-30T10:02:00.000Z",
    });
  });

  it("completes a final automatically approved stage without human review", () => {
    expect(projectTaskStatusAfterCompletedGoal(stage("on_goal_complete"), null)).toBe("done");
    expect(projectTaskStatusAfterCompletedGoal(stage("on_goal_complete"), "build")).toBe("review");
    expect(projectTaskStatusAfterCompletedGoal(stage("on_human_accept"), null)).toBe("review");
  });
});
