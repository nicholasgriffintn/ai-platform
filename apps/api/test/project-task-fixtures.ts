import { createAdhocProjectFlow, type ProjectTask } from "@ngriffin_uk/polychat-schemas";

export function projectTaskFixture(overrides: Partial<ProjectTask> = {}): ProjectTask {
  const flow = overrides.flowSnapshot ?? createAdhocProjectFlow();
  const nodeId = overrides.nodeId ?? flow.entryNodeId;
  const dispatched =
    overrides.status === "queued" ||
    overrides.status === "running" ||
    overrides.status === "blocked";

  return {
    id: "task-1",
    projectId: "project-1",
    workspaceId: "workspace-1",
    objective: "Ship the pricing note",
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
    nodeId,
    flowSnapshot: flow,
    flowExecution: {
      epoch: 1,
      nodeId,
      steps: dispatched ? 1 : 0,
      iterations: {},
      values: {},
      waitId: dispatched ? "wait" : null,
    },
    flowRevision: 0,
    runner: null,
    createdByUserId: 7,
    assigneeUserId: null,
    runnerIdentityUserId: dispatched ? 7 : null,
    conversationId: null,
    originConversationId: null,
    goalId: null,
    dispatchTaskId: null,
    runId: null,
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
