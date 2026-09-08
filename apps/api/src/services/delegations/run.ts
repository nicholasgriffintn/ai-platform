import {
  createChatCompletionsJsonSchema,
  DELEGATION_WAKE_TASK_TYPE,
  delegationRunTaskDataSchema,
} from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/lib/context/serviceContext";
import { TaskService } from "~/services/tasks/TaskService";
import { createTeammateCompletion } from "~/services/teammates/createTeammateCompletion";
import { requireProjectAccess } from "~/services/workspaces/access";
import type { IEnv } from "~/types";

import type { TaskMessage } from "../tasks/TaskService";

export async function runDelegationTask(message: TaskMessage, env: IEnv) {
  const payload = delegationRunTaskDataSchema.parse(message.task_data);
  const context = createServiceContext({ env });
  const delegation = await context.repositories.delegations.claimDelegation(payload.delegationId);

  if (!delegation) {
    return { status: "skipped" as const, detail: "Delegation is already running or settled" };
  }

  if (Date.parse(delegation.budget.deadline) <= Date.now()) {
    await context.repositories.delegations.updateState(delegation.id, "expired", {
      summary: "The delegation deadline passed before it started.",
      outputIds: [],
    });
    await enqueueDelegationWake(context, delegation, message.user_id);

    return { status: "skipped" as const, detail: "Delegation expired before it started" };
  }

  const user = await context.repositories.users.getUserById(message.user_id ?? 0);

  if (!user) {
    await context.repositories.delegations.updateState(delegation.id, "failed", {
      summary: "The delegating user no longer exists.",
      outputIds: [],
    });
    await enqueueDelegationWake(context, delegation, message.user_id);

    return { status: "error" as const, detail: "Delegating user not found" };
  }

  if (payload.projectId) {
    await requireProjectAccess(createServiceContext({ env, user }), payload.projectId);
  }

  const body = createChatCompletionsJsonSchema.parse({
    completion_id: delegation.childConversationId,
    command_id: `delegation_run_${delegation.id}`,
    messages: [{ role: "user", content: delegation.goal }],
    stream: false,
    store: true,
    enabled_tools: payload.enabledTools,
    delegation_context: {
      delegationId: delegation.id,
      depth: delegation.depth,
      rootConversationId: delegation.parentConversationId,
    },
    ...(payload.projectId ? { metadata: { project_id: payload.projectId } } : {}),
  });

  try {
    const response = await createTeammateCompletion({
      env,
      context: createServiceContext({ env, user }),
      body,
      teammateId: delegation.teammateId,
      user,
      anonymousUser: undefined,
      conversationType: "delegate",
      trigger: "delegation",
      maxStepsOverride: delegation.budget.maxSteps,
      durableExecution: {
        kind: "delegation",
        maxCreditMicros: delegation.budget.maxCreditMicros,
      },
    });

    if (!(response instanceof Response)) {
      const firstPendingTool = response.choices.find(
        (choice) => choice.message.status === "pending",
      )?.message;
      if (firstPendingTool) {
        const waitingState =
          firstPendingTool.name === "ask_user" ? "awaiting_input" : "awaiting_approval";
        await context.repositories.delegations.updateState(delegation.id, waitingState);

        return {
          status: "success" as const,
          detail: `Delegate is ${waitingState.replace("awaiting_", "awaiting ")}.`,
        };
      }
    }

    const summary =
      response instanceof Response ? "Delegate run accepted." : "Delegate run completed.";

    await context.repositories.delegations.updateState(delegation.id, "done", {
      summary,
      outputIds: [],
    });
    await enqueueDelegationWake(context, delegation, message.user_id);

    return { status: "success" as const, detail: summary };
  } catch (error) {
    const summary = error instanceof Error ? error.message : "Delegate run failed.";

    await context.repositories.delegations.updateState(delegation.id, "failed", {
      summary: summary.slice(0, 2000),
      outputIds: [],
    });
    await enqueueDelegationWake(context, delegation, message.user_id);

    return { status: "error" as const, detail: summary };
  }
}

async function enqueueDelegationWake(
  context: ReturnType<typeof createServiceContext>,
  delegation: { id: string; parentConversationId: string; parentRunId: string },
  userId: number | undefined,
) {
  if (userId === undefined) {
    return;
  }

  await new TaskService(context.env, context.repositories.tasks).enqueueTask({
    id: `delegation_wake_${delegation.parentRunId}`,
    task_type: DELEGATION_WAKE_TASK_TYPE,
    user_id: userId,
    priority: 4,
    task_data: {
      parentConversationId: delegation.parentConversationId,
      parentRunId: delegation.parentRunId,
    },
  });
}
