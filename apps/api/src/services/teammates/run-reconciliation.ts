import {
  isTerminalChatRunStatus,
  recipeExecutionTaskDataSchema,
  teammateRunConfigurationSchema,
  type ChatRun,
  type Delegation,
  type DelegationState,
} from "@ngriffin_uk/polychat-schemas";

import type { AgentLoopExecutionResult } from "~/lib/chat/agent/agent-loop";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { deliverRecipeOccurrenceToTeammateHome } from "~/services/apps/recipes/occurrences";
import { deliverRecipeSmsNotification } from "~/services/apps/recipes/sms-notification";
import { getRecipeExecutionTaskId } from "~/services/apps/recipes/task-reconciliation";
import {
  buildDelegationPendingResult,
  buildDelegationResultFromMessage,
  listDelegationResultOutputIds,
} from "~/services/delegations/result";
import { scheduleDelegationExpiry } from "~/services/delegations/schedule-expiry";
import { transitionDelegation } from "~/services/delegations/settle";
import { isRunWaitingForDelegations } from "~/services/delegations/wait-policy";
import { notifyMobileWork } from "~/services/mobile-push";
import { isTaskNotificationPreferenceEnabled } from "~/services/notifications/preferences";
import { TaskService } from "~/services/tasks/TaskService";
import type { IUser, Message } from "~/types";
import { safeParseJson } from "~/utils/json";
import { extractMessageNotification } from "~/utils/messages";
import { isRecord } from "~/utils/objects";

type ResultMessage = Pick<Message, "content" | "data" | "id" | "status" | "citations">;
type WaitingDelegationState = Extract<
  DelegationState,
  "awaiting_input" | "awaiting_approval" | "awaiting_takeover"
>;

function parseStoredValue(value: unknown): unknown {
  return typeof value === "string" ? (safeParseJson<unknown>(value) ?? value) : value;
}

function storedResultMessage(row: Record<string, unknown> | undefined): ResultMessage | undefined {
  if (!row || row.role !== "assistant" || row.content === undefined) {
    return undefined;
  }

  const citations = parseStoredValue(row.citations);
  const data = parseStoredValue(row.data);

  return {
    content: parseStoredValue(row.content) as Message["content"],
    ...(typeof row.id === "string" ? { id: row.id } : {}),
    ...(typeof row.status === "string" ? { status: row.status } : {}),
    ...(Array.isArray(citations)
      ? {
          citations: citations.filter((item): item is string => typeof item === "string"),
        }
      : {}),
    ...(isRecord(data) ? { data } : {}),
  };
}

async function resolveResultMessage(
  context: ServiceContext,
  run: ChatRun,
  result?: AgentLoopExecutionResult,
): Promise<ResultMessage | undefined> {
  if (result?.finalMessage) {
    return result.finalMessage;
  }

  const messages = await context.repositories.messages.getRunMessages(run.conversationId, run.id);
  const selected =
    messages.find((message) => message.id === run.lastMessageId) ??
    [...messages].reverse().find((message) => message.role === "assistant");

  return storedResultMessage(selected);
}

function waitingDelegationState(run: ChatRun): WaitingDelegationState | null {
  switch (run.status) {
    case "awaiting_input":
    case "awaiting_approval":
    case "awaiting_takeover":
      return run.status;
    default:
      return null;
  }
}

async function notifyDelegationAttention(
  context: ServiceContext,
  delegation: Delegation,
  run: ChatRun,
  userId: number,
  state: "awaiting_input" | "awaiting_approval" | "awaiting_takeover",
): Promise<void> {
  await context.repositories.conversations.markUnreadForUser(
    delegation.parentConversationId,
    userId,
  );
  const parent = await context.repositories.conversations.getConversation(
    delegation.parentConversationId,
  );
  const projectId = typeof parent?.project_id === "string" ? parent.project_id : null;

  if (!projectId) {
    return;
  }

  const project = await context.repositories.workspaces.getProject(projectId);
  const preferences = await context.repositories.taskNotifications.getPreferences(userId);

  if (
    !project ||
    !isTaskNotificationPreferenceEnabled(preferences, "decisions") ||
    !(await context.repositories.workspaces.getMembership(project.workspace_id, userId))
  ) {
    return;
  }

  await notifyMobileWork({
    context,
    userId,
    notificationId: `delegation:${delegation.id}:${state}`,
    kind: state === "awaiting_approval" ? "approval" : "input",
    target: {
      workspaceId: project.workspace_id,
      projectId,
      conversationId: delegation.parentConversationId,
      taskId: null,
      runId: run.id,
      interactionId: run.lastMessageId,
    },
  });
}

async function reconcileDelegationRun(params: {
  context: ServiceContext;
  user: IUser;
  run: ChatRun;
  delegationId: string;
  result?: AgentLoopExecutionResult;
}): Promise<void> {
  const delegation = await params.context.repositories.delegations.getById(params.delegationId);

  if (!delegation || delegation.childConversationId !== params.run.conversationId) {
    throw new Error("Delegation run no longer matches its durable assignment");
  }

  if (params.run.status === "running") {
    if (
      delegation.state === "awaiting_input" ||
      delegation.state === "awaiting_approval" ||
      delegation.state === "awaiting_takeover"
    ) {
      await transitionDelegation(params.context, delegation.id, "running");
    }

    return;
  }

  const message = await resolveResultMessage(params.context, params.run, params.result);
  const waitingState = waitingDelegationState(params.run);

  if (waitingState) {
    if (!message) {
      throw new Error("Suspended delegation has no persisted interaction message");
    }

    await transitionDelegation(
      params.context,
      delegation.id,
      waitingState,
      buildDelegationPendingResult(message),
    );
    await notifyDelegationAttention(
      params.context,
      delegation,
      params.run,
      params.user.id,
      waitingState,
    );
    await scheduleDelegationExpiry(
      new TaskService(params.context.env, params.context.repositories.tasks),
      delegation,
      params.user.id,
    );

    return;
  }

  if (!isTerminalChatRunStatus(params.run.status)) {
    return;
  }

  if (
    params.run.status === "succeeded" &&
    (await isRunWaitingForDelegations(params.context, params.run.id))
  ) {
    return;
  }

  let state: Extract<DelegationState, "done" | "failed" | "cancelled">;
  let result;

  if (params.run.status === "succeeded") {
    const built = await buildDelegationResultFromMessage(
      params.context,
      message,
      params.run.id,
      params.run.lastMessageId,
    );

    state = built.failed ? "failed" : "done";
    result = built.result;
  } else {
    state = params.run.status === "cancelled" ? "cancelled" : "failed";
    result = {
      summary: params.run.terminalReason ?? "The delegated run did not complete.",
      outputIds: await listDelegationResultOutputIds(params.context, params.run.id),
      finalMessageId: params.run.lastMessageId,
      citations: [],
      outstandingQuestions: [],
    };
  }

  const transitioned = await transitionDelegation(
    params.context,
    delegation.id,
    state,
    result,
    params.user.id,
  );

  if (transitioned) {
    await params.context.repositories.conversations.markUnreadForUser(
      delegation.parentConversationId,
      params.user.id,
    );
  }
}

async function reconcileRoutineRun(params: {
  context: ServiceContext;
  user: IUser;
  run: ChatRun;
  installationId: string;
  occurrenceId: string;
  result?: AgentLoopExecutionResult;
}): Promise<void> {
  if (!waitingDelegationState(params.run) && !isTerminalChatRunStatus(params.run.status)) {
    return;
  }

  if (
    params.run.status === "succeeded" &&
    (await isRunWaitingForDelegations(params.context, params.run.id))
  ) {
    return;
  }

  if (!params.run.teammateContextId) {
    throw new Error("Routine run is missing its teammate context");
  }

  const teammateContext = await params.context.repositories.teammateContexts.getById(
    params.run.teammateContextId,
  );
  const installation = await params.context.repositories.templates.getTemplateById(
    params.installationId,
  );

  if (!teammateContext || !installation || teammateContext.actorUserId !== params.user.id) {
    return;
  }

  const message = await resolveResultMessage(params.context, params.run, params.result);
  const conversation = await params.context.repositories.conversations.getConversation(
    params.run.conversationId,
  );
  const title =
    typeof conversation?.title === "string"
      ? conversation.title.replace(/^Recipe:\s*/u, "")
      : "Routine";
  const summary = message?.content
    ? typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content)
    : (params.run.terminalReason ?? undefined);

  const homeDelivery = await deliverRecipeOccurrenceToTeammateHome({
    context: params.context,
    user: params.user,
    teammateContext,
    installationId: params.installationId,
    occurrenceId: params.occurrenceId,
    conversationId: params.run.conversationId,
    recipeTitle: title,
    run: params.run,
    summary,
    ...(params.run.status === "failed" || params.run.status === "interrupted"
      ? {
          failure: params.run.terminalReason ?? "The routine did not complete.",
        }
      : {}),
  });

  const taskId = getRecipeExecutionTaskId(params.run.conversationId);

  if (homeDelivery === "delivered" && params.run.status === "succeeded" && taskId) {
    const task = await params.context.repositories.tasks.getTaskById(taskId);
    const taskData = recipeExecutionTaskDataSchema.safeParse(task?.task_data);

    if (taskData.success) {
      await deliverRecipeSmsNotification({
        env: params.context.env,
        context: params.context,
        user: params.user,
        userId: params.user.id,
        taskId,
        taskData: taskData.data,
        notification: extractMessageNotification(
          message?.content,
          message?.data,
          "Recipe execution completed.",
        ),
      });
    }
  }
}

export function teammateRunNeedsReconciliation(run: ChatRun): boolean {
  const parsed = teammateRunConfigurationSchema.safeParse(run.resolvedConfiguration);

  return (
    parsed.success &&
    (parsed.data.invocation?.source === "delegation" ||
      parsed.data.invocation?.source === "routine")
  );
}

export async function reconcileTeammateRun(
  context: ServiceContext,
  run: ChatRun,
  result?: AgentLoopExecutionResult,
): Promise<void> {
  const parsed = teammateRunConfigurationSchema.safeParse(run.resolvedConfiguration);

  if (!parsed.success || !parsed.data.invocation) {
    return;
  }

  const user = context.user ?? (await context.repositories.users.getUserById(run.initiatorUserId));

  if (!user || user.id !== run.initiatorUserId) {
    throw new Error("Teammate run initiator is unavailable");
  }

  const invocation = parsed.data.invocation;

  if (invocation.source === "delegation") {
    await reconcileDelegationRun({
      context,
      user,
      run,
      delegationId: invocation.delegationId,
      result,
    });
  } else if (invocation.source === "routine") {
    await reconcileRoutineRun({
      context,
      user,
      run,
      installationId: invocation.installationId,
      occurrenceId: invocation.occurrenceId,
      result,
    });
  }
}
