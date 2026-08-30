import type {
  Goal,
  ProjectFlowStage,
  ProjectTaskCompletion,
  ProjectTaskStatus,
} from "@ngriffin_uk/polychat-schemas";

import { generateId } from "~/utils/id";

export function createProjectTaskCompletion(params: {
  stage: ProjectFlowStage | null;
  conversationId: string;
  goal: Goal;
  output: string;
  createdAt?: string;
}): ProjectTaskCompletion {
  const automated = params.stage?.advance !== "on_human_accept";

  return {
    id: generateId(),
    stageId: params.stage?.id ?? null,
    conversationId: params.conversationId,
    goalId: params.goal.id,
    output: params.output,
    evidence: params.goal.evidence ?? [],
    approval: {
      mode: automated ? "automated" : "human",
      status: automated ? "approved" : "pending",
      reviewedByUserId: null,
      reviewedAt: automated ? (params.createdAt ?? new Date().toISOString()) : null,
    },
    createdAt: params.createdAt ?? new Date().toISOString(),
  };
}

export function approveLatestProjectTaskCompletion(
  completions: readonly ProjectTaskCompletion[],
  userId: number,
  reviewedAt = new Date().toISOString(),
): ProjectTaskCompletion[] {
  let pendingIndex = -1;

  for (let index = completions.length - 1; index >= 0; index -= 1) {
    const completion = completions[index];

    if (completion.approval.mode === "human" && completion.approval.status === "pending") {
      pendingIndex = index;
      break;
    }
  }

  if (pendingIndex < 0) {
    return [...completions];
  }

  return completions.map((completion, index) =>
    index === pendingIndex
      ? {
          ...completion,
          approval: {
            ...completion.approval,
            status: "approved",
            reviewedByUserId: userId,
            reviewedAt,
          },
        }
      : completion,
  );
}

export function projectTaskStatusAfterCompletedGoal(
  stage: ProjectFlowStage | null,
  nextStageId: string | null,
): ProjectTaskStatus {
  return stage?.advance === "on_goal_complete" && !nextStageId ? "done" : "review";
}
