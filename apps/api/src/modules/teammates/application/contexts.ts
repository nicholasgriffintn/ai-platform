import {
  getConnectorProviderConfig,
  isConnectorConnectionKindForAuth,
} from "@ngriffin_uk/polychat-ai-integrations";
import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import {
  isPolyTeammateId,
  type MemoryDocument,
  type UpdateMemoryDocumentInput,
  type TeammateConnectionGrant,
  type TeammateConnectionGrantListResponse,
  type TeammateContext,
  type TeammateContextScope,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ProviderConnectionRepository } from "~/modules/connectors/infrastructure/ProviderConnectionRepository";
import { formatMemoryDocument } from "~/modules/memory-documents/application/memory-documents";
import { MemoryDocumentRepository } from "~/modules/memory-documents/infrastructure/MemoryDocumentRepository";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";
import {
  requireProjectAccess,
  requireWorkspaceAccess,
} from "~/modules/workspaces/application/access";

import { requireScopedTeammateAccess, requireTeammateAccess } from "./access";
import { carryProjectContextsIntoWorkspace } from "./work-scope";

async function requireContextScope(
  context: ServiceContext,
  scope: TeammateContextScope,
  userId: number,
): Promise<void> {
  if (scope.type === "personal") {
    if (scope.id !== String(userId)) {
      throw new AssistantError("Personal teammate scope is unavailable", ErrorType.FORBIDDEN, 403);
    }

    return;
  }

  if (scope.type === "workspace") {
    await requireWorkspaceAccess(context, scope.id);

    return;
  }

  await requireProjectAccess(context, scope.id);
}

export async function listTeammateContexts(
  context: ServiceContext,
  teammateId: string,
): Promise<{ contexts: TeammateContext[] }> {
  const user = context.requireUser();

  const contexts = await context.repositories
    .get(TeammateContextRepository)
    .listForTeammate(teammateId, user.id);

  if (contexts.length === 0) {
    await requireTeammateAccess(context, teammateId, "read", user.id);
  } else {
    await Promise.all(
      contexts.map((teammateContext) =>
        requireScopedTeammateAccess(context, teammateId, teammateContext.scope, user.id),
      ),
    );
  }

  return { contexts };
}

export async function ensureTeammateContext(
  context: ServiceContext,
  teammateId: string,
  scope: TeammateContextScope,
): Promise<TeammateContext> {
  const user = context.requireUser();

  await requireContextScope(context, scope, user.id);
  await requireScopedTeammateAccess(context, teammateId, scope, user.id);

  const existing = await context.repositories.get(TeammateContextRepository).getByIdentity({
    teammateId,
    actorUserId: user.id,
    scope,
  });

  if (existing) {
    return existing;
  }

  const contextId = `teammate_context_${generateId()}`;
  const homeConversationId = `teammate_home_${generateId()}`;
  const memoryDocumentId = generateId();

  try {
    const created = await context.repositories.get(TeammateContextRepository).createWithResources({
      id: contextId,
      teammateId,
      actorUserId: user.id,
      scope,
      homeConversationId,
      homeConversationType: isPolyTeammateId(teammateId) ? "poly" : "chat",
      autonomyLevel: isPolyTeammateId(teammateId)
        ? "assistant"
        : scope.type === "workspace"
          ? "partner"
          : null,
      memoryDocumentId,
      memoryDocumentName: `teammate-${generateId().toLowerCase()}`,
    });

    if (scope.type === "workspace") {
      await carryProjectContextsIntoWorkspace(context, created);
    }

    return created;
  } catch (error) {
    const raced = await context.repositories.get(TeammateContextRepository).getByIdentity({
      teammateId,
      actorUserId: user.id,
      scope,
    });

    if (raced) {
      return raced;
    }

    throw error;
  }
}

export async function ensureActiveTeammateContext(
  context: ServiceContext,
  teammateId: string,
  scope: TeammateContextScope,
): Promise<TeammateContext> {
  const teammateContext = await ensureTeammateContext(context, teammateId, scope);

  if (teammateContext.status !== "active") {
    throw new AssistantError("Teammate context is not active", ErrorType.CONFLICT_ERROR, 409);
  }

  return teammateContext;
}

export async function requireOwnedTeammateContext(
  context: ServiceContext,
  contextId: string,
): Promise<TeammateContext> {
  const user = context.requireUser();
  const teammateContext = await context.repositories
    .get(TeammateContextRepository)
    .getById(contextId);

  if (!teammateContext || !ownsResource(user.id, teammateContext.actorUserId)) {
    throw new AssistantError("Teammate context not found", ErrorType.NOT_FOUND, 404);
  }

  await requireContextScope(context, teammateContext.scope, user.id);
  await requireScopedTeammateAccess(
    context,
    teammateContext.teammateId,
    teammateContext.scope,
    user.id,
  );

  return teammateContext;
}

export async function requireTeammateContext(
  context: ServiceContext,
  contextId: string,
): Promise<TeammateContext> {
  const teammateContext = await requireOwnedTeammateContext(context, contextId);

  if (teammateContext.status !== "active") {
    throw new AssistantError("Teammate context is not active", ErrorType.CONFLICT_ERROR, 409);
  }

  return teammateContext;
}

async function requireContextMemoryDocument(context: ServiceContext, contextId: string) {
  const teammateContext = await requireTeammateContext(context, contextId);
  const document = await context.repositories
    .get(MemoryDocumentRepository)
    .getDocumentById(teammateContext.memoryDocumentId);

  if (
    !document ||
    document.scope_type !== "personal" ||
    document.scope_id !== String(teammateContext.actorUserId)
  ) {
    throw new AssistantError("Teammate memory is unavailable", ErrorType.FORBIDDEN, 403);
  }

  return document;
}

export async function getTeammateContextMemory(
  context: ServiceContext,
  contextId: string,
): Promise<MemoryDocument> {
  return formatMemoryDocument(await requireContextMemoryDocument(context, contextId));
}

export async function updateTeammateContextMemory(
  context: ServiceContext,
  contextId: string,
  input: Pick<UpdateMemoryDocumentInput, "content" | "changeNote" | "expectedRevision">,
): Promise<MemoryDocument> {
  const user = context.requireUser();
  const document = await requireContextMemoryDocument(context, contextId);
  const updated = await context.repositories.get(MemoryDocumentRepository).appendRevision({
    documentId: document.id,
    content: input.content,
    changeNote: input.changeNote ?? null,
    createdByUserId: user.id,
    expectedRevision: input.expectedRevision,
  });

  if (!updated) {
    throw new AssistantError(
      "This teammate memory changed while you were editing it. Reload and try again.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return formatMemoryDocument(updated);
}

export async function listTeammateConnectionGrants(
  context: ServiceContext,
  contextId: string,
): Promise<TeammateConnectionGrantListResponse> {
  const teammateContext = await requireTeammateContext(context, contextId);
  const records = await context.repositories
    .get(ProviderConnectionRepository)
    .listConnections(teammateContext.actorUserId);
  const connections = records.flatMap((connection) => {
    const provider = getConnectorProviderConfig(connection.provider);

    if (
      !provider ||
      connection.status !== "connected" ||
      !isConnectorConnectionKindForAuth(connection.kind, provider.auth.authType) ||
      (provider.auth.authType === "composio" && !connection.external_id)
    ) {
      return [];
    }

    return [
      {
        id: connection.id,
        provider: provider.id,
        providerName: provider.name,
        accountId: connection.external_id || null,
        operations: provider.operations.map((operation) => ({
          id: operation.id,
          access: operation.access,
          destructive: operation.destructive === true,
          important: operation.isImportant === true,
        })),
      },
    ];
  });

  return {
    grants: await context.repositories
      .get(TeammateContextRepository)
      .listConnectionGrants(contextId),
    connections,
  };
}

export async function upsertTeammateConnectionGrant(
  context: ServiceContext,
  contextId: string,
  input: {
    connectionId: string;
    allowedOperations: string[];
    expectedRevision?: number;
  },
): Promise<TeammateConnectionGrant> {
  const user = context.requireUser();

  await requireTeammateContext(context, contextId);

  const connection = await context.repositories
    .get(ProviderConnectionRepository)
    .getConnectionById(input.connectionId);

  if (
    !connection ||
    !ownsResource(user.id, connection.user_id) ||
    connection.status !== "connected"
  ) {
    throw new AssistantError("Connection not found", ErrorType.NOT_FOUND, 404);
  }

  const provider = getConnectorProviderConfig(connection.provider);

  if (
    !provider ||
    !isConnectorConnectionKindForAuth(connection.kind, provider.auth.authType) ||
    (provider.auth.authType === "composio" && !connection.external_id)
  ) {
    throw new AssistantError(
      "Connection cannot be granted to a teammate",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const allowedOperations = [
    ...new Set(input.allowedOperations.map((operation) => operation.trim())),
  ]
    .filter(Boolean)
    .sort();
  const supportedOperations = new Set(provider.operations.map((operation) => operation.id));

  if (allowedOperations.some((operation) => !supportedOperations.has(operation))) {
    throw new AssistantError(
      "One or more connection operations are unavailable",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (allowedOperations.length > 0) {
    const existingGrants = await context.repositories
      .get(TeammateContextRepository)
      .listConnectionGrants(contextId);
    const competingConnections = await Promise.all(
      existingGrants
        .filter(
          (grant) =>
            grant.connectionId !== input.connectionId && grant.allowedOperations.length > 0,
        )
        .map((grant) =>
          context.repositories
            .get(ProviderConnectionRepository)
            .getConnectionById(grant.connectionId),
        ),
    );

    if (competingConnections.some((candidate) => candidate?.provider === connection.provider)) {
      throw new AssistantError(
        `Remove the existing ${provider.name} account grant before choosing another account`,
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }
  }

  const grant = await context.repositories.get(TeammateContextRepository).upsertConnectionGrant({
    contextId,
    connectionId: input.connectionId,
    allowedOperations,
    expectedRevision: input.expectedRevision,
  });

  if (!grant) {
    throw new AssistantError(
      "The connection grant changed before it could be saved",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return grant;
}
