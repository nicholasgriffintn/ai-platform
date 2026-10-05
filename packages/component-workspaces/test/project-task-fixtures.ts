import {
  createSequentialProjectFlow,
  type ProjectFlow,
  type ProjectTask,
  type ProjectTaskActivityTimeline,
  type ProjectTaskPlanEvidence,
} from "@ngriffin_uk/polychat-schemas";

export const flow: ProjectFlow = createSequentialProjectFlow(
  [
    {
      id: "research",
      name: "Research",
      instructions: null,
      teammateId: "teammate-research",
      skillIds: [],
      mode: "explore",
      requiresApprovalFor: [],
    },
    {
      id: "publish",
      name: "Publish",
      instructions: null,
      teammateId: "teammate-publish",
      skillIds: [],
      mode: "build",
      requiresApprovalFor: ["write"],
    },
  ],
  ["publish"],
);

export const task: ProjectTask = {
  id: "task-1",
  originConversationId: null,
  projectId: "project-1",
  workspaceId: "workspace-1",
  objective: "Prepare the release note",
  acceptanceCriteria: [],
  expectedOutput: "A reviewed release note",
  context: null,
  constraints: null,
  dependsOnTaskIds: [],
  requireApprovalFor: [],
  status: "queued",
  source: "user",
  blockedReason: null,
  blockedDetail: null,
  nodeId: "research",
  flowSnapshot: flow,
  flowExecution: {
    epoch: 1,
    nodeId: "research",
    steps: 1,
    iterations: {},
    values: {},
    waitId: "wait-research",
  },
  flowRevision: 1,
  runner: null,
  createdByUserId: 1,
  assigneeUserId: null,
  runnerIdentityUserId: 1,
  conversationId: null,
  goalId: null,
  dispatchTaskId: null,
  completions: [],
  position: 1000,
  tokenBudget: 20_000,
  tokensSpent: 0,
  createdAt: "2026-08-30T10:00:00.000Z",
  updatedAt: null,
  startedAt: null,
  completedAt: null,
};

export const emptyActivity: ProjectTaskActivityTimeline = {
  protocolVersion: 1,
  projectId: task.projectId,
  taskId: task.id,
  items: [],
};

export const emptyPlan: ProjectTaskPlanEvidence = {
  protocolVersion: 1,
  id: task.id,
  status: "active",
  nodes: [
    {
      id: `${task.id}:research`,
      flowNodeId: "research",
      name: "Research",
      status: "proposed",
      input: { objective: task.objective, acceptanceCriterionIds: [] },
      attempts: [],
      completionIds: [],
      outputs: [],
    },
  ],
  resume: { supported: true, reason: null },
};
