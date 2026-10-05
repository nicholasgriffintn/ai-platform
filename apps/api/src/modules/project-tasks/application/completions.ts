import type {
  ChatRun,
  Goal,
  ProjectFlowAgentNode,
  ProjectTaskCompletion,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

export function createProjectTaskCompletion(params: {
  node: ProjectFlowAgentNode | null;
  humanReview: boolean;
  conversationId: string;
  goal: Goal;
  run?: ChatRun | null;
  dispatchTaskId?: string;
  outputIds?: string[];
  output: string;
  createdAt?: string;
}): ProjectTaskCompletion {
  const automated = !params.humanReview;

  return {
    id: generateId(),
    nodeId: params.node?.id ?? null,
    conversationId: params.conversationId,
    goalId: params.goal.id,
    runId: params.run?.id ?? null,
    runAttempt: params.run?.attempt ?? null,
    dispatchTaskId: params.dispatchTaskId ?? null,
    outputIds: params.outputIds ?? [],
    output: params.output,
    evidence: params.goal.evidence ?? [],
    approval: {
      mode: automated ? "automated" : "human",
      status: automated ? "approved" : "pending",
      reviewedByUserId: null,
      reviewedAt: automated ? (params.createdAt ?? new Date().toISOString()) : null,
      reviewWaitId: null,
    },
    createdAt: params.createdAt ?? new Date().toISOString(),
  };
}
