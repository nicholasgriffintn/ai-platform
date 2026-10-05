import {
  createOidcConnectionSchema,
  oidcConnectionSchema,
  updateOidcConnectionSchema,
  type OidcConnection,
} from "@ngriffin_uk/polychat-schemas";
import { canonicalJson, generateId } from "@ngriffin_uk/polychat-utility-core";
import {
  encryptJsonPayload,
  decryptJsonPayload,
  isEncryptedJsonPayload,
} from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord, safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import { readStringField } from "@ngriffin_uk/polychat-utility-server/record-fields";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { EnterpriseIdentityConnectionRow } from "~/infrastructure/database/schema";
import { requireWorkspaceAccess } from "~/modules/workspaces/application/access";

import { discoverOidcEndpoints } from "./discovery";

export function toOidcConnection(row: EnterpriseIdentityConnectionRow): OidcConnection {
  return oidcConnectionSchema.parse({
    ...parseJsonRecord(row.configuration),
    id: row.id,
    workspaceId: row.workspace_id,
    label: row.label,
    issuer: row.issuer,
    clientId: row.client_id,
    revision: row.revision,
    enabled: Number(row.enabled) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function credentialContext(connection: OidcConnection): string {
  return canonicalJson([
    1,
    "enterprise-identity",
    connection.id,
    connection.workspaceId,
    connection.issuer,
    connection.clientId,
    connection.revision,
  ]);
}

function requireCredentialKey(context: ServiceContext): string {
  if (!context.env.JWT_SECRET) {
    throw new AssistantError(
      "Identity credential encryption is not configured",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  return context.env.JWT_SECRET;
}

export async function openOidcSecret(
  context: ServiceContext,
  row: EnterpriseIdentityConnectionRow,
): Promise<string> {
  const encrypted = safeParseJson(row.encrypted_secret);

  if (!isEncryptedJsonPayload(encrypted)) {
    throw new AssistantError(
      "Stored identity credentials are invalid",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  const payload = await decryptJsonPayload({
    keyMaterial: requireCredentialKey(context),
    encrypted,
    additionalData: credentialContext(toOidcConnection(row)),
    invalidMessage: "Stored identity credentials are invalid",
    reconnectMessage: "Identity credentials could not be decrypted",
  });
  const secret = readStringField(payload, "clientSecret");

  if (!secret) {
    throw new AssistantError(
      "Identity credentials are missing",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  return secret;
}

async function sealOidcSecret(
  context: ServiceContext,
  connection: OidcConnection,
  clientSecret: string,
): Promise<string> {
  return JSON.stringify(
    await encryptJsonPayload({
      keyMaterial: requireCredentialKey(context),
      payload: { clientSecret },
      additionalData: credentialContext(connection),
    }),
  );
}

export async function getWorkspaceOidcConnection(context: ServiceContext, workspaceId: string) {
  await requireWorkspaceAccess(context, workspaceId, ["owner"]);
  const row = await context.repositories.enterpriseIdentities.getForWorkspace(workspaceId);

  return { connection: row ? toOidcConnection(row) : null };
}

export async function createWorkspaceOidcConnection(
  context: ServiceContext,
  workspaceId: string,
  request: unknown,
) {
  await requireWorkspaceAccess(context, workspaceId, ["owner"]);
  const { clientSecret, ...input } = createOidcConnectionSchema.parse(request);

  if (await context.repositories.enterpriseIdentities.getForWorkspace(workspaceId)) {
    throw new AssistantError(
      "This workspace already has an identity connection",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const connection: OidcConnection = {
    ...input,
    id: generateId(),
    workspaceId,
    revision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };

  if (connection.enabled) {
    await discoverOidcEndpoints(connection);
  }

  await context.repositories.enterpriseIdentities.create(
    connection,
    await sealOidcSecret(context, connection, clientSecret),
    context.requireUser().id,
  );
  const stored = await context.repositories.enterpriseIdentities.getById(connection.id);

  if (!stored) {
    throw new AssistantError(
      "Workspace ownership changed before identity configuration",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: context.requireUser().id,
    action: "workspace.identity.created",
    targetType: "identity_connection",
    targetId: connection.id,
    metadata: { revision: 1, enabled: connection.enabled },
  });

  return { connection: toOidcConnection(stored) };
}

export async function updateWorkspaceOidcConnection(
  context: ServiceContext,
  workspaceId: string,
  request: unknown,
) {
  await requireWorkspaceAccess(context, workspaceId, ["owner"]);
  const input = updateOidcConnectionSchema.parse(request);
  const row = await context.repositories.enterpriseIdentities.getForWorkspace(workspaceId);

  if (!row) {
    throw new AssistantError("Identity connection not found", ErrorType.NOT_FOUND, 404);
  }

  if (input.expectedRevision !== row.revision) {
    throw new AssistantError(
      "Identity configuration changed; reload before saving",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const { expectedRevision, clientSecret, ...fields } = input;
  const connection = { ...toOidcConnection(row), ...fields, revision: expectedRevision + 1 };

  if (connection.enabled) {
    await discoverOidcEndpoints(connection);
  }

  const secret = clientSecret ?? (await openOidcSecret(context, row));
  const stored = await context.repositories.enterpriseIdentities.update(
    connection,
    await sealOidcSecret(context, connection, secret),
    context.requireUser().id,
  );

  if (!stored) {
    throw new AssistantError(
      "Identity configuration or workspace ownership changed",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: context.requireUser().id,
    action: "workspace.identity.updated",
    targetType: "identity_connection",
    targetId: connection.id,
    metadata: {
      revision: connection.revision,
      enabled: connection.enabled,
      credentialRotated: Boolean(clientSecret),
    },
  });

  return { connection: toOidcConnection(stored) };
}

export async function deleteWorkspaceOidcConnection(context: ServiceContext, workspaceId: string) {
  await requireWorkspaceAccess(context, workspaceId, ["owner"]);
  const row = await context.repositories.enterpriseIdentities.getForWorkspace(workspaceId);

  if (row) {
    const deleted = await context.repositories.enterpriseIdentities.delete(
      row.id,
      workspaceId,
      context.requireUser().id,
    );

    if (!deleted) {
      throw new AssistantError(
        "Workspace ownership changed before identity disconnection",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    await context.repositories.audit.createRecord({
      workspaceId,
      actorUserId: context.requireUser().id,
      action: "workspace.identity.disconnected",
      targetType: "identity_connection",
      targetId: row.id,
    });
  }

  return { success: true };
}
