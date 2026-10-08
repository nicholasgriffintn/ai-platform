import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { mcpConnectionSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ProviderConnectionRecord } from "~/modules/apps/infrastructure/ProviderConnectionRepository";

export const MCP_TOKEN_CONNECTION_KIND = "mcp_bearer";
export const MCP_OAUTH_CONNECTION_KIND = "mcp_oauth";

export const MCP_CONNECTION_KINDS = new Set([MCP_TOKEN_CONNECTION_KIND, MCP_OAUTH_CONNECTION_KIND]);
const connectionMetadataSchema = mcpConnectionSchema.omit({ id: true, createdAt: true });

export function publicMcpConnection(record: ProviderConnectionRecord) {
  const metadata = connectionMetadataSchema.parse(safeParseJson(record.metadata));

  return { ...metadata, id: record.id, createdAt: record.created_at };
}

export function mcpConnectionKey(env: Pick<ServiceContext["env"], "JWT_SECRET">, userId: number) {
  const secret = env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new AssistantError(
      "MCP credential encryption is not configured",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  return `${secret}:${userId}:mcp-connection`;
}

export function connectionKey(context: ServiceContext): string {
  return mcpConnectionKey(context.env, context.requireUser().id);
}

export async function requireConnection(context: ServiceContext, connectionId: string) {
  const connection = await context.repositories.providerConnections.getConnectionById(connectionId);

  if (
    !connection ||
    connection.provider !== "mcp" ||
    !MCP_CONNECTION_KINDS.has(connection.kind) ||
    connection.status !== "connected" ||
    !ownsResource(context.requireUser().id, connection.user_id)
  ) {
    throw new AssistantError("MCP connection is unavailable", ErrorType.NOT_FOUND, 404);
  }

  return connection;
}
