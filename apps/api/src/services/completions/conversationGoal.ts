import {
  goalResponseSchema,
  type GoalResponse,
  type UpdateGoalRequest,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import { recordGoalMarker } from "~/services/goals/goalMarker";
import { GoalService } from "~/services/goals/GoalService";
import { AssistantError, ErrorType } from "~/utils/errors";

export type ConversationGoalContext = Pick<
  ServiceContext,
  "database" | "ensureDatabase" | "env" | "repositories" | "requireUser"
>;

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

export async function handleGetConversationGoal(
  context: ConversationGoalContext,
  completionId: string,
): Promise<GoalResponse> {
  const user = context.requireUser();
  const service = createService(context);

  service.assertPro(user);

  const goal = await service.getActiveGoal({ conversationId: completionId });

  return goalResponseSchema.parse({ goal });
}

export async function handleSetConversationGoal(
  context: ConversationGoalContext,
  completionId: string,
  objective: string,
): Promise<GoalResponse> {
  const user = context.requireUser();
  const service = createService(context);

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
