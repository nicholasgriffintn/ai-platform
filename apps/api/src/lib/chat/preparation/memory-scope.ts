import type { DelegationMemoryBinding } from "@ngriffin_uk/polychat-schemas";

import type { MemoryDocumentRow } from "~/lib/database/schema";
import type { RepositoryManager } from "~/repositories";
import type { ProjectChatContext } from "~/services/workspaces/chatContext";
import type { CoreChatOptions, MemoryScope } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

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

export function bindRunMemoryDocument(
  scope: MemoryScope,
  binding: DelegationMemoryBinding & {
    scopeType: "personal" | "project";
    scopeId: string;
    conversationId: string;
  },
): MemoryScope {
  if (scope.type === "bound") {
    if (scope.scopeType !== binding.scopeType || scope.scopeId !== binding.scopeId) {
      throw new AssistantError(
        "The conversation document is outside this run's memory scope",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    return {
      ...scope,
      conversationId: binding.conversationId,
      documents: mergeBindings([...scope.documents, binding]),
    };
  }

  if (scope.type === "project" && binding.scopeId !== scope.projectId) {
    throw new AssistantError(
      "The conversation document is outside this project",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  return {
    type: "bound",
    scopeType: binding.scopeType,
    scopeId: binding.scopeId,
    conversationId: binding.conversationId,
    baseline: scope,
    documents: [binding],
  };
}

export async function resolveRunMemoryScope(params: {
  options: CoreChatOptions;
  repositories: RepositoryManager;
  projectContext: ProjectChatContext | null;
}): Promise<MemoryScope> {
  const userId = params.options.context?.user?.id;
  const scopeType = params.projectContext ? "project" : "personal";
  const scopeId = params.projectContext?.projectId ?? String(userId ?? "");
  const contextId = params.options.teammate_context_id;
  const teammateContext = contextId
    ? await params.repositories.teammateContexts.getById(contextId)
    : null;

  if (
    contextId &&
    (!userId ||
      !teammateContext ||
      teammateContext.actorUserId !== userId ||
      teammateContext.status !== "active" ||
      teammateContext.scope.type !== scopeType ||
      teammateContext.scope.id !== scopeId)
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
  repositories: RepositoryManager,
): Promise<RunMemoryDocument[]> {
  if (scope.type !== "bound") {
    return [];
  }

  const documents: RunMemoryDocument[] = [];

  for (const binding of scope.documents) {
    const document = await repositories.memoryDocuments.getDocumentById(binding.documentId);
    const inConversationScope =
      document?.scope_type === scope.scopeType && document.scope_id === scope.scopeId;
    const isContextMemory =
      document?.id === scope.teammateContext?.memoryDocumentId &&
      document.scope_type === "personal";

    if (!document || (!inConversationScope && !isContextMemory)) {
      throw new AssistantError(
        "A memory document granted to this run is no longer available",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    documents.push({ access: binding.access, document });
  }

  return documents;
}
