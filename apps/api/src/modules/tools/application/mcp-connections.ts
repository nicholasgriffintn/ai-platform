import {
  mcpConnectionInputSchema,
  mcpCredentialEndpointSchema,
  type McpConnectionInput,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import {
  decryptJsonPayload,
  encryptJsonPayload,
  isEncryptedJsonPayload,
} from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import {
  connectionKey,
  MCP_CONNECTION_KINDS,
  MCP_OAUTH_CONNECTION_KIND,
  MCP_TOKEN_CONNECTION_KIND,
  publicMcpConnection,
  requireConnection,
} from "./mcp-connection-records";
import { resolveMcpOAuthAccessToken } from "./mcp-oauth-connections";

export async function createMcpConnection(context: ServiceContext, input: McpConnectionInput) {
  input = mcpConnectionInputSchema.parse(input);
  const url = new URL(mcpCredentialEndpointSchema.parse(input.url)).toString();
  const externalId = generateId();
  const encrypted = await encryptJsonPayload({
    keyMaterial: connectionKey(context),
    additionalData: `${externalId}:${url}`,
    payload: { token: input.token },
  });
  const record = await context.repositories.providerConnections.upsertConnection({
    userId: context.requireUser().id,
    provider: "mcp",
    kind: MCP_TOKEN_CONNECTION_KIND,
    externalId,
    encryptedData: encrypted,
    metadata: {
      label: input.label,
      url,
      credentialRecipient: input.credentialRecipient,
      authMethod: "token",
      allowedTools: [...new Set(input.allowedTools)],
    },
  });

  return publicMcpConnection(record);
}

export async function listMcpConnections(context: ServiceContext) {
  const records = await context.repositories.providerConnections.listConnections(
    context.requireUser().id,
    "mcp",
  );

  return {
    connections: records
      .filter((r) => MCP_CONNECTION_KINDS.has(r.kind) && r.status === "connected")
      .map(publicMcpConnection),
  };
}

export async function deleteMcpConnection(context: ServiceContext, connectionId: string) {
  const record = await requireConnection(context, connectionId);

  await context.repositories.providerConnections.deleteConnection(
    record.user_id,
    "mcp",
    record.kind,
    record.external_id,
  );

  return { success: true };
}

export async function resolveMcpCredential(
  context: ServiceContext,
  input: { connectionId: string; url: string; provider: string; allowedTools?: string[] },
) {
  const record = await requireConnection(context, input.connectionId);
  const connection = publicMcpConnection(record);

  if (
    record.kind !== MCP_TOKEN_CONNECTION_KIND ||
    input.provider !== connection.credentialRecipient
  ) {
    throw new AssistantError(
      "This MCP connection is not approved for this model provider",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const url = new URL(mcpCredentialEndpointSchema.parse(input.url)).toString();

  if (connection.url !== url) {
    throw new AssistantError(
      "MCP connection does not match this endpoint",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const allowedTools = input.allowedTools ?? connection.allowedTools;

  if (
    allowedTools.length === 0 ||
    allowedTools.some((tool) => !connection.allowedTools.includes(tool))
  ) {
    throw new AssistantError("MCP tool access exceeds this connection", ErrorType.FORBIDDEN, 403);
  }

  const encrypted = safeParseJson(record.encrypted_data);

  if (!isEncryptedJsonPayload(encrypted)) {
    throw new AssistantError(
      "MCP connection needs to be reconnected",
      ErrorType.CONFIGURATION_ERROR,
      409,
    );
  }

  const payload = await decryptJsonPayload({
    keyMaterial: connectionKey(context),
    encrypted,
    additionalData: `${record.external_id}:${url}`,
  });

  if (typeof payload.token !== "string") {
    throw new AssistantError(
      "MCP connection needs to be reconnected",
      ErrorType.CONFIGURATION_ERROR,
      409,
    );
  }

  await requireConnection(context, input.connectionId);

  return { authorization: payload.token, allowedTools: [...new Set(allowedTools)] };
}

export async function resolveMcpGatewayAccess(
  context: ServiceContext,
  input: { connectionId: string; url: string; allowedTools?: string[] },
): Promise<{ headers: Record<string, string>; allowedTools: string[] }> {
  const record = await requireConnection(context, input.connectionId);

  if (record.kind !== MCP_OAUTH_CONNECTION_KIND) {
    const { authorization, allowedTools } = await resolveMcpCredential(context, {
      connectionId: input.connectionId,
      url: input.url,
      provider: "polychat",
      allowedTools: input.allowedTools,
    });

    return { headers: { Authorization: `Bearer ${authorization}` }, allowedTools };
  }

  const connection = publicMcpConnection(record);
  const allowedTools = input.allowedTools ?? connection.allowedTools;

  if (connection.url !== new URL(mcpCredentialEndpointSchema.parse(input.url)).toString()) {
    throw new AssistantError(
      "MCP connection does not match this endpoint",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  if (allowedTools.some((tool) => !connection.allowedTools.includes(tool))) {
    throw new AssistantError("MCP tool access exceeds this connection", ErrorType.FORBIDDEN, 403);
  }

  return {
    headers: { Authorization: `Bearer ${await resolveMcpOAuthAccessToken(context, record)}` },
    allowedTools: [...new Set(allowedTools)],
  };
}
