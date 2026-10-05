import {
  MEMORY_REFLECTION_TASK_TYPE,
  type MemoryReflectionTaskData,
  type MemoryReflectionStatus,
} from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { toStringValue } from "@ngriffin_uk/polychat-utility-server/strings";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { resolveMemoryPolicy } from "~/modules/chat/domain/memory";
import { requireConversationAccess } from "~/modules/conversations/application/access";
import { MemoryReflectionRepository } from "~/modules/memory-documents/infrastructure/MemoryReflectionRepository";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { TaskExecutionContext } from "~/modules/tasks/application/types";
import {
  getTeammateContextMemory,
  requireTeammateContext,
} from "~/modules/teammates/application/contexts";

import { generateMemoryReflection, prepareMemoryReflection } from "./reflection-generation";
import { applyMemoryReflectionProposal } from "./reflection-proposal";
import {
  selectMemoryReflectionSources,
  assertMemoryReflectionSourcesUnchanged,
  hasMemoryReflectionSources,
} from "./reflection-sources";

export async function requireMemoryReflectionConsent(context: ServiceContext) {
  const actor = context.requireUser();
  const [user, userSettings] = await Promise.all([
    context.repositories.users.getUserById(actor.id),
    context.repositories.userSettings.getUserSettings(actor.id),
  ]);

  if (!resolveMemoryPolicy({ user, userSettings, store: true }).canStore) {
    throw new AssistantError("Memory saving consent is unavailable", ErrorType.FORBIDDEN, 403);
  }
}

async function requireReflectionScope(
  context: ServiceContext,
  contextId: string,
  conversationId: string,
) {
  const teammate = await requireTeammateContext(context, contextId);
  const conversation = await requireConversationAccess(context, conversationId);
  const scopeId =
    typeof conversation.project_id === "string"
      ? conversation.project_id
      : toStringValue(conversation.user_id, "");
  const scopeType = typeof conversation.project_id === "string" ? "project" : "personal";

  if (teammate.scope.type !== scopeType || teammate.scope.id !== scopeId) {
    throw new AssistantError("Memory source belongs to another scope", ErrorType.FORBIDDEN, 403);
  }

  return teammate;
}

export async function enqueueMemoryReflection(
  context: ServiceContext,
  input: Omit<MemoryReflectionTaskData, "afterMessageId">,
) {
  const user = context.requireUser();
  const teammate = await requireReflectionScope(context, input.contextId, input.conversationId);

  if (input.reason === "correction") {
    await requireMemoryReflectionConsent(context);
  }

  const repository = new MemoryReflectionRepository(context.env);
  const afterMessageId = await repository.checkpoint(input.contextId, input.conversationId);

  if (afterMessageId === input.throughMessageId) {
    return null;
  }

  const data: MemoryReflectionTaskData = {
    contextId: input.contextId,
    conversationId: input.conversationId,
    throughMessageId: input.throughMessageId,
    afterMessageId,
    reason: input.reason,
  };
  const previous = await repository.latestSourceTask(data, user.id);
  const retryOf =
    input.reason === "maintenance" &&
    (previous?.status === "failed" || previous?.status === "cancelled")
      ? previous.id
      : null;
  const id =
    previous && !retryOf
      ? previous.id
      : `memory_reflection_${await sha256Hex(JSON.stringify({ ...data, retryOf }))}`;
  const service = new TaskService(context.env, context.repositories.tasks);

  await service.enqueueTask({
    id,
    task_type: MEMORY_REFLECTION_TASK_TYPE,
    user_id: user.id,
    project_id: teammate.scope.type === "project" ? teammate.scope.id : undefined,
    task_data: data,
  });

  return id;
}

export async function requestTeammateMemoryMaintenance(context: ServiceContext, contextId: string) {
  const teammate = await requireTeammateContext(context, contextId);
  const recent = await context.repositories.messages.getConversationMessagesBefore(
    teammate.homeConversationId,
    1,
  );
  const last = recent[0];

  if (!last || typeof last.id !== "string") {
    return { taskId: null, status: "idle" as const, error: null };
  }

  const taskId = await enqueueMemoryReflection(context, {
    contextId,
    conversationId: teammate.homeConversationId,
    throughMessageId: last.id,
    reason: "maintenance",
  });

  return { taskId, status: taskId ? ("queued" as const) : ("idle" as const), error: null };
}

export async function getTeammateMemoryMaintenance(
  context: ServiceContext,
  contextId: string,
): Promise<MemoryReflectionStatus> {
  await requireTeammateContext(context, contextId);
  const task = await new MemoryReflectionRepository(context.env).latestTask(
    contextId,
    context.requireUser().id,
  );

  if (!task) {
    return { taskId: null, status: "idle", error: null };
  }

  const status = task.status === "pending" ? "queued" : task.status;

  if (
    status !== "queued" &&
    status !== "running" &&
    status !== "completed" &&
    status !== "failed" &&
    status !== "cancelled"
  ) {
    throw new Error("Unexpected memory maintenance task state");
  }

  return { taskId: task.id, status, error: task.error_message };
}

export async function reflectTeammateMemory(
  context: ServiceContext,
  input: MemoryReflectionTaskData,
  taskId: string,
  execution: TaskExecutionContext,
) {
  const user = context.requireUser();
  const teammate = await requireReflectionScope(context, input.contextId, input.conversationId);
  const repository = new MemoryReflectionRepository(context.env);
  const previous = await repository.outcome(taskId);

  if (input.reason === "correction") {
    await requireMemoryReflectionConsent(context);
  }

  if (previous) {
    if (previous.through_message_id !== input.throughMessageId) {
      await enqueueMemoryReflection(context, input);
    }

    return previous.status;
  }

  const afterMessageId = await repository.checkpoint(input.contextId, input.conversationId);
  const rows = await context.repositories.messages.getMemoryReflectionMessages({
    ...input,
    afterMessageId,
    userId: user.id,
  });

  if (!rows.length) {
    return "no_change";
  }

  const base = await context.repositories.memoryDocuments.getDocumentById(
    teammate.memoryDocumentId,
  );

  if (!base) {
    throw new AssistantError("Teammate memory is unavailable", ErrorType.FORBIDDEN, 403);
  }

  await getTeammateContextMemory(context, input.contextId);
  const prepared = hasMemoryReflectionSources(rows)
    ? await prepareMemoryReflection(context, base.content)
    : null;
  const { sources, throughMessageId } = selectMemoryReflectionSources(
    rows,
    prepared?.sourceTokenBudget,
  );

  await execution.lease.assertOwned();

  const proposal =
    prepared && sources.length
      ? await generateMemoryReflection(
          context,
          prepared,
          sources,
          `${taskId}:${execution.deliveryAttempt}`,
          input.conversationId,
        )
      : { edits: [], changeNote: "No new user evidence" };
  const content = applyMemoryReflectionProposal(base.content, proposal, sources);

  await requireReflectionScope(context, input.contextId, input.conversationId);

  if (input.reason === "correction") {
    await requireMemoryReflectionConsent(context);
  }

  assertMemoryReflectionSourcesUnchanged(
    sources,
    await context.repositories.messages.getMemoryReflectionMessages({
      ...input,
      afterMessageId,
      throughMessageId,
      userId: user.id,
    }),
    prepared?.sourceTokenBudget,
  );

  await execution.lease.assertOwned();
  const result = await repository.commit({
    operationId: taskId,
    taskId,
    contextId: input.contextId,
    conversationId: input.conversationId,
    afterMessageId,
    throughMessageId,
    base,
    content,
    changeNote: proposal.changeNote,
    evidenceJson: JSON.stringify(proposal.edits),
    userId: user.id,
    ownerToken: execution.lease.ownerToken,
  });

  if (!result) {
    throw new AssistantError(
      "Memory or sources changed during maintenance; retry against current state",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (throughMessageId !== input.throughMessageId) {
    await enqueueMemoryReflection(context, input);
  }

  return result.status;
}
