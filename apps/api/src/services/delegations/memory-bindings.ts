import type { DelegationMemoryBinding } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { MemoryDocumentRow } from "~/lib/database/schema";
import { AssistantError, ErrorType } from "~/utils/errors";

interface RequestedBinding {
  documentId: string;
  access: "read" | "read-write";
}

function isDocumentInScope(
  document: MemoryDocumentRow,
  userId: number,
  projectId: string | null,
): boolean {
  return projectId
    ? document.scope_type === "project" && document.scope_id === projectId
    : document.scope_type === "personal" && document.scope_id === String(userId);
}

export async function resolveDelegationMemoryBindings(params: {
  context: ServiceContext;
  userId: number;
  projectId: string | null;
  requested?: readonly RequestedBinding[];
  required?: readonly RequestedBinding[];
  allowed?: readonly DelegationMemoryBinding[];
}): Promise<DelegationMemoryBinding[]> {
  const requested = new Map<string, DelegationMemoryBinding>();

  for (const binding of params.requested ?? []) {
    requested.set(binding.documentId, {
      documentId: binding.documentId,
      access: binding.access,
    });
  }

  for (const binding of params.required ?? []) {
    requested.set(binding.documentId, binding);
  }

  const resolved: DelegationMemoryBinding[] = [];
  const allowed = params.allowed
    ? new Map(params.allowed.map((binding) => [binding.documentId, binding.access]))
    : null;

  for (const binding of requested.values()) {
    const document = await params.context.repositories.memoryDocuments.getDocumentById(
      binding.documentId,
    );

    if (!document || !isDocumentInScope(document, params.userId, params.projectId)) {
      throw new AssistantError(
        "A requested delegation document is unavailable in this conversation scope",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    const isRequired = params.required?.some(
      (required) => required.documentId === binding.documentId,
    );
    const parentAccess = allowed?.get(binding.documentId);

    if (
      !isRequired &&
      allowed &&
      (!parentAccess || (binding.access === "read-write" && parentAccess !== "read-write"))
    ) {
      throw new AssistantError(
        "A requested delegation document exceeds the parent run's authority",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    resolved.push(binding);
  }

  return resolved;
}

export async function revalidateDelegationMemoryBindings(params: {
  context: ServiceContext;
  userId: number;
  projectId: string | null;
  bindings: readonly DelegationMemoryBinding[];
}): Promise<DelegationMemoryBinding[]> {
  return resolveDelegationMemoryBindings({ ...params, requested: params.bindings });
}
