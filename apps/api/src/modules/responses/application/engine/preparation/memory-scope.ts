import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import type { DelegationMemoryBinding } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { Repositories } from "~/infrastructure/database/repositories";
import type { MemoryDocumentRow } from "~/infrastructure/database/schema";
import { requireRunMemoryDocument } from "~/modules/memory-documents/application/run-access";
import { teammateContextCoversRun } from "~/modules/teammates/domain/context-scope";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";
import type { ProjectChatContext } from "~/modules/workspaces/application/chatContext";
import type { CoreChatOptions, MemoryScope } from "~/types";

function mergeBindings(bindings: readonly DelegationMemoryBinding[]): DelegationMemoryBinding[] {
  const merged = new Map<string, DelegationMemoryBinding>();

  for (const binding of bindings) {
    const existing = merged.get(binding.documentId);

    merged.set(binding.documentId, {
      documentId: binding.documentId,
      access:
        existing?.access === "read-write" || binding.access === "read-write"
          ? "read-write"
          : "read",
    });
  }

  return [...merged.values()];
}

export async function resolveRunMemoryScope(params: {
  options: CoreChatOptions;
  repositories: Repositories;
  projectContext: ProjectChatContext | null;
}): Promise<MemoryScope> {
  const userId = params.options.context?.user?.id;
  const scopeType = params.projectContext ? "project" : "personal";
  const scopeId = params.projectContext?.projectId ?? String(userId ?? "");
  const contextId = params.options.teammate_context_id;
  const teammateContext = contextId
    ? await params.repositories.get(TeammateContextRepository).getById(contextId)
    : null;

  if (
    contextId &&
    (!userId ||
      !teammateContext ||
      !ownsResource(userId, teammateContext.actorUserId) ||
      teammateContext.status !== "active" ||
      !teammateContextCoversRun(teammateContext.scope, {
        type: scopeType,
        id: scopeId,
        workspaceId: params.projectContext?.workspaceId ?? null,
      }))
  ) {
    throw new AssistantError(
      "The teammate working context is no longer available for this run",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const delegated = params.options.delegation_context?.memoryBindings ?? [];

  if (teammateContext) {
    const baseline: MemoryScope = params.projectContext
      ? { type: "project", projectId: params.projectContext.projectId }
      : { type: "personal" };

    return {
      type: "bound",
      scopeType,
      scopeId,
      conversationId: params.options.completion_id,
      baseline,
      documents: mergeBindings([
        ...delegated,
        { documentId: teammateContext.memoryDocumentId, access: "read-write" },
      ]),
      teammateContext: {
        id: teammateContext.id,
        memoryDocumentId: teammateContext.memoryDocumentId,
      },
    };
  }

  if (delegated.length > 0) {
    return {
      type: "bound",
      scopeType,
      scopeId,
      conversationId: params.options.completion_id,
      documents: delegated,
    };
  }

  return params.projectContext
    ? { type: "project", projectId: params.projectContext.projectId }
    : { type: "personal" };
}

export interface RunMemoryDocument {
  access: DelegationMemoryBinding["access"];
  document: MemoryDocumentRow;
}

export async function loadRunMemoryDocuments(
  scope: MemoryScope,
  context: ServiceContext | undefined,
): Promise<RunMemoryDocument[]> {
  if (scope.type !== "bound") {
    return [];
  }

  if (!context) {
    throw new AssistantError("Memory documents require a signed-in run", ErrorType.FORBIDDEN, 403);
  }

  return Promise.all(
    scope.documents.map((binding) => requireRunMemoryDocument(context, scope, binding.documentId)),
  );
}
