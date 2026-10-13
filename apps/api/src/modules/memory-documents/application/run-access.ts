import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireTeammateContext } from "~/modules/teammates/application/contexts";
import { requireProjectAccess } from "~/modules/workspaces/application/access";
import type { MemoryScope } from "~/types";

export async function requireRunMemoryDocument(
  context: ServiceContext,
  scope: MemoryScope,
  documentId: string,
  access: "read" | "read-write" = "read",
) {
  const user = context.requireUser();

  if (scope.type !== "bound") {
    if (scope.type === "project") {
      await requireProjectAccess(context, scope.projectId);
    }

    const document = await context.repositories.memoryDocuments.getDocumentById(documentId);
    const scopeType = scope.type === "project" ? "project" : "personal";
    const scopeId = scope.type === "project" ? scope.projectId : String(user.id);

    if (
      !document ||
      document.kind !== "memory" ||
      document.scope_type !== scopeType ||
      document.scope_id !== scopeId ||
      access !== "read"
    ) {
      throw new AssistantError(
        "The memory document is unavailable in this scope",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    return { access: "read" as const, document };
  }

  const binding = scope.documents.find((item) => item.documentId === documentId);

  if (!binding || (access === "read-write" && binding.access !== access)) {
    throw new AssistantError("This document is not granted to this run", ErrorType.FORBIDDEN, 403);
  }

  if (scope.scopeType === "project") {
    await requireProjectAccess(context, scope.scopeId);
  } else if (scope.scopeId !== String(user.id)) {
    throw new AssistantError("Memory scope is unavailable", ErrorType.FORBIDDEN, 403);
  }

  const teammate = scope.teammateContext
    ? await requireTeammateContext(context, scope.teammateContext.id)
    : null;

  if (
    teammate &&
    (teammate.scope.type !== scope.scopeType ||
      teammate.scope.id !== scope.scopeId ||
      teammate.memoryDocumentId !== scope.teammateContext?.memoryDocumentId)
  ) {
    throw new AssistantError("The teammate memory grant changed", ErrorType.FORBIDDEN, 403);
  }

  const document = await context.repositories.memoryDocuments.getDocumentById(documentId);
  const inScope = document?.scope_type === scope.scopeType && document.scope_id === scope.scopeId;
  const privateMemory =
    teammate &&
    document?.id === teammate.memoryDocumentId &&
    document.scope_type === "personal" &&
    document.scope_id === String(user.id);

  if (!document || (!inScope && !privateMemory)) {
    throw new AssistantError("The memory document is unavailable", ErrorType.FORBIDDEN, 403);
  }

  return { access: binding.access, document };
}
