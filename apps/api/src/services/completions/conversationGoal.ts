import {
  goalResponseSchema,
  recordGoalIterationResponseSchema,
  type GoalResponse,
  type Goal,
  type GoalContinuationReason,
  type GoalIterationOutcome,
  type RecordGoalIterationRequest,
  type RecordGoalIterationResponse,
  type UpdateGoalRequest,
} from "@ngriffin_uk/polychat-schemas";

import { GOAL_UNSATISFIED_INSTRUCTION } from "~/lib/chat/agent/goal-gate";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import {
  getSandboxRunRecordForUser,
  requireSandboxRunWriteAuthority,
} from "~/services/apps/sandbox/runs";
import {
  requireConversationAccess,
  requireOwnConversationForWrite,
} from "~/services/conversations/access";
import { recordGoalMarker } from "~/services/goals/goalMarker";
import { GoalService } from "~/services/goals/GoalService";
import { AssistantError, ErrorType } from "~/utils/errors";

export type ConversationGoalContext = ServiceContext;

function createService(context: ConversationGoalContext): GoalService {
  context.ensureDatabase();

  return new GoalService(context.repositories.goals);
}

export async function handleGetRunGoal(
  context: ConversationGoalContext,
  runId: string,
): Promise<GoalResponse> {
  const user = context.requireUser();
  const service = createService(context);

  service.assertPro(user);

  await getSandboxRunRecordForUser({ context, userId: user.id, runId });

  const goal = await service.getActiveGoal({ sandboxRunId: runId });

  return goalResponseSchema.parse({ goal });
}

export async function handleSetRunGoal(
  context: ConversationGoalContext,
  runId: string,
  objective: string,
): Promise<GoalResponse> {
  const user = context.requireUser();
  const service = createService(context);

  await requireSandboxRunWriteAuthority({ context, userId: user.id, runId });

  const goal = await service.setGoal({
    owner: { sandboxRunId: runId },
    user,
    objective,
    source: "user",
  });

  return goalResponseSchema.parse({ goal });
}

export async function handleUpdateRunGoal(
  context: ConversationGoalContext,
  runId: string,
  update: UpdateGoalRequest,
): Promise<GoalResponse> {
  const user = context.requireUser();
  const service = createService(context);

  service.assertPro(user);

  await requireSandboxRunWriteAuthority({ context, userId: user.id, runId });

  const active = await service.getActiveGoal({ sandboxRunId: runId });

  if (!active) {
    throw new AssistantError("There is no goal on this run", ErrorType.NOT_FOUND);
  }

  const goal = await service.transition({
    goalId: active.id,
    actor: "user",
    status: update.status,
  });

  return goalResponseSchema.parse({ goal });
}

export async function handleRecordRunGoalIteration(
  context: ConversationGoalContext,
  runId: string,
  iteration: RecordGoalIterationRequest,
): Promise<RecordGoalIterationResponse> {
  const user = context.requireUser();
  const service = createService(context);

  service.assertPro(user);

  await requireSandboxRunWriteAuthority({ context, userId: user.id, runId });

  const active = await service.getActiveGoal({ sandboxRunId: runId });

  if (!active || active.status !== "active") {
    const current =
      active ?? (await context.repositories.goals.listGoals({ sandboxRunId: runId }, 1))[0] ?? null;

    return recordGoalIterationResponseSchema.parse({
      goal: current,
      shouldContinue: false,
      ...describeGoalIteration(current, false),
    });
  }

  const { goal, shouldContinue } = await service.recordIteration({
    goalId: active.id,
    iteration: {
      surface: "sandbox",
      summary: iteration.summary,
      evidence: iteration.evidence,
      next: iteration.next,
      producedEvidence: iteration.producedEvidence,
      calledTool: iteration.calledTool,
      tokens: iteration.tokens,
    },
  });

  return recordGoalIterationResponseSchema.parse({
    goal,
    shouldContinue,
    ...describeGoalIteration(goal, shouldContinue),
    ...(shouldContinue ? { instruction: GOAL_UNSATISFIED_INSTRUCTION } : {}),
  });
}

function describeGoalIteration(
  goal: Goal | null,
  shouldContinue: boolean,
): {
  status: Goal["status"] | null;
  outcome: GoalIterationOutcome;
  reason: GoalContinuationReason;
} {
  if (!goal) {
    return { status: null, outcome: "missing", reason: "no-goal" };
  }

  if (goal.status === "active") {
    return {
      status: goal.status,
      outcome: "continue",
      reason: shouldContinue ? "continue" : "not-active",
    };
  }

  const byStatus = {
    paused: { outcome: "paused", reason: "not-active" },
    completed: { outcome: "completed", reason: "not-active" },
    cleared: { outcome: "cleared", reason: "not-active" },
    blocked: { outcome: "blocked", reason: "awaiting-approval" },
    stalled: { outcome: "stalled", reason: "stalled" },
    limit_reached: { outcome: "limit_reached", reason: "usage-limits" },
  } as const;

  return { status: goal.status, ...byStatus[goal.status] };
}

export async function handleGetConversationGoal(
  context: ConversationGoalContext,
  completionId: string,
): Promise<GoalResponse> {
  const user = context.requireUser();
  const service = createService(context);

  service.assertPro(user);

  await requireConversationAccess(context, completionId);

  const goal = await service.getActiveGoal({ conversationId: completionId });

  return goalResponseSchema.parse({ goal });
}

export async function handleSetConversationGoal(
  context: ConversationGoalContext,
  completionId: string,
  objective: string,
  options?: { projectId?: string },
): Promise<GoalResponse> {
  const user = context.requireUser();
  const service = createService(context);

  await requireOwnConversationForWrite(context, completionId, options);

  const goal = await service.setGoal({
    owner: { conversationId: completionId },
    user,
    objective,
    source: "user",
  });

  await recordGoalMarker({
    conversationManager: ConversationManager.getInstance({
      database: context.database,
      user,
      env: context.env,
    }),
    completionId,
    goal,
    event: "set",
  });

  return goalResponseSchema.parse({ goal });
}

export async function handleUpdateConversationGoal(
  context: ConversationGoalContext,
  completionId: string,
  update: UpdateGoalRequest,
): Promise<GoalResponse> {
  const user = context.requireUser();
  const service = createService(context);

  service.assertPro(user);

  await requireConversationAccess(context, completionId);

  const active = await service.getActiveGoal({ conversationId: completionId });

  if (!active) {
    throw new AssistantError("There is no goal on this conversation", ErrorType.NOT_FOUND);
  }

  const goal = await service.transition({
    goalId: active.id,
    actor: "user",
    status: update.status,
  });

  await recordGoalMarker({
    conversationManager: ConversationManager.getInstance({
      database: context.database,
      user,
      env: context.env,
    }),
    completionId,
    goal,
    event:
      update.status === "paused" ? "paused" : update.status === "cleared" ? "cleared" : "resumed",
  });

  return goalResponseSchema.parse({ goal });
}
