import type {
  MemoryDocument,
  UpdateMemoryDocumentInput,
  TeammateConnectionGrant,
  TeammateConnectionGrantListResponse,
  TeammateContext,
  TeammateContextScope,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { getConnectorProviderConfig } from "~/lib/providers/capabilities/connectors";
import { isConnectorConnectionKindForAuth } from "~/services/apps/connectors/connection-references";
import { formatMemoryDocument } from "~/services/memory-documents";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { requireScopedTeammateAccess, requireTeammateAccess } from "./access";

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

  await requireProjectAccess(context, scope.id);
}

export async function listTeammateContexts(
  context: ServiceContext,
  teammateId: string,
): Promise<{ contexts: TeammateContext[] }> {
  const user = context.requireUser();

  const contexts = await context.repositories.teammateContexts.listForTeammate(teammateId, user.id);

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

  const existing = await context.repositories.teammateContexts.getByIdentity({
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
    return await context.repositories.teammateContexts.createWithResources({
      id: contextId,
      teammateId,
      actorUserId: user.id,
      scope,
      homeConversationId,
      memoryDocumentId,
      memoryDocumentName: `teammate-${generateId().toLowerCase()}`,
    });
  } catch (error) {
    const raced = await context.repositories.teammateContexts.getByIdentity({
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
  const teammateContext = await context.repositories.teammateContexts.getById(contextId);

  if (!teammateContext || teammateContext.actorUserId !== user.id) {
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
  const document = await context.repositories.memoryDocuments.getDocumentById(
    teammateContext.memoryDocumentId,
  );

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
  const updated = await context.repositories.memoryDocuments.appendRevision({
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
  const records = await context.repositories.providerConnections.listConnections(
    teammateContext.actorUserId,
  );
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
        allowedOperations: provider.operations.map((operation) => operation.id),
      },
    ];
  });

  return {
    grants: await context.repositories.teammateContexts.listConnectionGrants(contextId),
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

  const connection = await context.repositories.providerConnections.getConnectionById(
    input.connectionId,
  );

  if (!connection || connection.user_id !== user.id || connection.status !== "connected") {
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
    const existingGrants =
      await context.repositories.teammateContexts.listConnectionGrants(contextId);
    const competingConnections = await Promise.all(
      existingGrants
        .filter(
          (grant) =>
            grant.connectionId !== input.connectionId && grant.allowedOperations.length > 0,
        )
        .map((grant) =>
          context.repositories.providerConnections.getConnectionById(grant.connectionId),
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

  const grant = await context.repositories.teammateContexts.upsertConnectionGrant({
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
