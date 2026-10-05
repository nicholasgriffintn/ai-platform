import {
  MEMORY_REFLECTION_TASK_TYPE,
  type MemoryReflectionTaskData,
} from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { toStringValue } from "@ngriffin_uk/polychat-utility-server/strings";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { resolveMemoryPolicy } from "~/modules/chat/domain/memory";
import { requireConversationAccess } from "~/modules/conversations/application/access";
import { gateMemoryClassification } from "~/modules/memory/application/gate";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { TaskExecutionContext } from "~/modules/tasks/application/types";
import {
  getTeammateContextMemory,
  requireTeammateContext,
} from "~/modules/teammates/application/contexts";
import type { MemoryScope } from "~/types";

import { generateMemoryReflection, prepareMemoryReflection } from "./reflection-generation";
import {
  applyMemoryReflectionProposal,
  selectMemoryReflectionSources,
  assertMemoryReflectionSourcesUnchanged,
  hasMemoryReflectionSources,
} from "./reflection-proposal";
import { requireRunMemoryDocument } from "./run-access";

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

  await requireMemoryReflectionConsent(context);

  const repository = context.repositories.memoryDocuments;
  const afterMessageId = await repository.reflectionCheckpoint(
    input.contextId,
    input.conversationId,
  );

  if (afterMessageId === input.throughMessageId) {
    return null;
  }

  const data: MemoryReflectionTaskData = {
    contextId: input.contextId,
    conversationId: input.conversationId,
    throughMessageId: input.throughMessageId,
    afterMessageId,
  };
  const id = `memory_reflection_${await sha256Hex(JSON.stringify(data))}`;
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

export async function reflectTeammateMemory(
  context: ServiceContext,
  input: MemoryReflectionTaskData,
  taskId: string,
  execution: TaskExecutionContext,
) {
  const user = context.requireUser();
  const teammate = await requireReflectionScope(context, input.contextId, input.conversationId);
  const repository = context.repositories.memoryDocuments;
  const previous = await repository.reflectionOutcome(taskId);

  await requireMemoryReflectionConsent(context);

  if (previous) {
    if (previous.through_message_id !== input.throughMessageId) {
      await enqueueMemoryReflection(context, input);
    }

    return previous.status;
  }

  const afterMessageId = await repository.reflectionCheckpoint(
    input.contextId,
    input.conversationId,
  );
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

  await requireMemoryReflectionConsent(context);

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
  const result = await repository.commitReflection({
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

export async function queueTeammateMemoryCorrection(input: {
  context: ServiceContext;
  scope: MemoryScope;
  conversationId: string;
  runId: string;
  classify: boolean;
}) {
  const { context, scope, conversationId, runId } = input;

  if (scope.type !== "bound" || !scope.teammateContext) {
    return null;
  }

  const user = context.requireUser();

  await requireRunMemoryDocument(
    context,
    scope,
    scope.teammateContext.memoryDocumentId,
    "read-write",
  );
  await requireMemoryReflectionConsent(context);

  const row = await context.repositories.messages.getMemoryReflectionInput({
    conversationId,
    runId,
    contextId: scope.teammateContext.id,
    userId: user.id,
  });

  if (!row) {
    return null;
  }

  const { sources } = selectMemoryReflectionSources([row]);
  const source = sources[0];

  if (!source) {
    return null;
  }

  if (input.classify) {
    const gate = await gateMemoryClassification({
      env: context.env,
      user,
      message: source.text,
      completionId: conversationId,
    });

    if (!gate.proceed) {
      return null;
    }
  }

  return enqueueMemoryReflection(context, {
    contextId: scope.teammateContext.id,
    conversationId,
    throughMessageId: source.id,
  });
}
