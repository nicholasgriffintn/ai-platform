import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import {
  integrationConnectionSchema,
  type IntegrationSnapshot,
} from "@ngriffin_uk/polychat-schemas";
import { canonicalJson, generateId } from "@ngriffin_uk/polychat-utility-core";
import {
  decryptJsonPayload,
  encryptJsonPayload,
  isEncryptedJsonPayload,
  sha256Hex,
} from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ProviderConnectionRecord } from "~/modules/apps/infrastructure/ProviderConnectionRepository";

export const MCP_CONNECTION_KIND = "native_mcp";

async function getEndpointBinding(snapshot: IntegrationSnapshot): Promise<string> {
  return sha256Hex(
    canonicalJson({ endpoint: snapshot.endpoint, authentication: snapshot.authentication }),
  );
}

function getConnectionKeyMaterial(
  context: ServiceContext,
  userId: number,
  definitionId: string,
): string {
  if (!context.env.JWT_SECRET) {
    throw new AssistantError(
      "Credential encryption is not configured",
      ErrorType.CONFIGURATION_ERROR,
      500,
    );
  }

  return `${context.env.JWT_SECRET}:${userId}:native-mcp:${definitionId}`;
}

export interface IntegrationConnection {
  record: ProviderConnectionRecord;
  accountId: string;
  token?: string;
}

export async function readIntegrationConnection(params: {
  context: ServiceContext;
  userId: number;
  definitionId: string;
  snapshot: IntegrationSnapshot;
}): Promise<IntegrationConnection | null> {
  if (!ownsResource(params.userId, params.context.requireUser().id)) {
    return null;
  }

  const record = await params.context.repositories.providerConnections.getConnection(
    params.userId,
    params.definitionId,
    MCP_CONNECTION_KIND,
  );

  if (!record || !ownsResource(params.userId, record.user_id) || record.status !== "connected") {
    return null;
  }

  const metadata = parseJsonRecord(record.metadata);
  const encrypted = parseJsonRecord(record.encrypted_data).encrypted;
  const binding = await getEndpointBinding(params.snapshot);

  if (
    !isEncryptedJsonPayload(encrypted) ||
    metadata.endpointBinding !== binding ||
    typeof metadata.credentialRevision !== "string"
  ) {
    return null;
  }

  const decrypted = await decryptJsonPayload({
    keyMaterial: getConnectionKeyMaterial(params.context, params.userId, params.definitionId),
    additionalData: binding,
    encrypted,
    invalidMessage: "Integration credentials are invalid",
    reconnectMessage: "Reconnect your integration account",
  });
  const credentials = integrationConnectionSchema.safeParse(decrypted);

  if (
    !credentials.success ||
    (params.snapshot.authentication === "bearer" && !credentials.data.token)
  ) {
    return null;
  }

  return {
    record,
    accountId: `${record.id}:${metadata.credentialRevision}`,
    token: credentials.data.token,
  };
}

export async function storeIntegrationConnection(params: {
  context: ServiceContext;
  userId: number;
  definitionId: string;
  snapshot: IntegrationSnapshot;
  token?: string;
}): Promise<void> {
  if (!ownsResource(params.userId, params.context.requireUser().id)) {
    throw new AssistantError(
      "Integration account does not belong to the authenticated actor",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const credentials = integrationConnectionSchema.parse({ token: params.token });

  if (params.snapshot.authentication === "bearer" && !credentials.token) {
    throw new AssistantError("Enter your personal access token", ErrorType.PARAMS_ERROR, 400);
  }

  if (params.snapshot.authentication === "none" && credentials.token) {
    throw new AssistantError(
      "This integration does not accept credentials",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const binding = await getEndpointBinding(params.snapshot);
  const encrypted = await encryptJsonPayload({
    keyMaterial: getConnectionKeyMaterial(params.context, params.userId, params.definitionId),
    additionalData: binding,
    payload: credentials,
  });

  await params.context.repositories.integrationDefinitions.upsertPersonalConnection({
    userId: params.userId,
    definitionId: params.definitionId,
    encryptedData: { encrypted },
    metadata: { endpointBinding: binding, credentialRevision: generateId() },
  });
}

export async function disconnectIntegrationConnection(
  context: ServiceContext,
  userId: number,
  definitionId: string,
): Promise<void> {
  if (!ownsResource(userId, context.requireUser().id)) {
    throw new AssistantError(
      "Integration account does not belong to the authenticated actor",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  await context.repositories.providerConnections.deleteConnection(
    userId,
    definitionId,
    MCP_CONNECTION_KIND,
  );
}
