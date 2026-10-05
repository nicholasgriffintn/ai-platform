import { authorise } from "@ngriffin_uk/polychat-library-policy";
import {
  nativeMcpCatalogToolSchema,
  nativeMcpIdSchema,
  nativeMcpServerSchema,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type {
  McpConnectionRecord,
  McpServerRecord,
} from "~/modules/mcp/infrastructure/McpRegistryRepository";
import { requireWorkspaceAccess } from "~/modules/workspaces/application/access";

export function readMcpCatalog(server: McpServerRecord) {
  return nativeMcpCatalogToolSchema.array().max(100).parse(safeParseJson(server.tools));
}

export function readMcpSharedProjects(connection: McpConnectionRecord) {
  return nativeMcpIdSchema.array().max(50).parse(safeParseJson(connection.shared_projects));
}

export async function requireMcpServer(context: ServiceContext, id: string, manage = false) {
  const user = context.requireUser();
  const server = await context.repositories.mcpRegistry.getServer(id, user.id);

  if (!server) {
    throw new AssistantError("MCP server not found", ErrorType.NOT_FOUND, 404);
  }

  if (server.workspace_id) {
    await requireWorkspaceAccess(
      context,
      server.workspace_id,
      manage ? ["owner", "admin"] : undefined,
    );
  } else if (
    !authorise("owner.access", {
      actorId: String(user.id),
      ownerId: String(server.created_by_user_id),
    }).allowed
  ) {
    throw new AssistantError("MCP server not found", ErrorType.NOT_FOUND, 404);
  }

  return server;
}

export function formatMcpServer(
  server: McpServerRecord,
  connection: McpConnectionRecord | null | undefined,
  managed: boolean,
) {
  return nativeMcpServerSchema.parse({
    id: server.id,
    label: server.label,
    endpoint: server.endpoint,
    workspaceId: server.workspace_id ?? undefined,
    revision: server.revision,
    enabled: Boolean(server.enabled),
    tools: readMcpCatalog(server),
    managed,
    connected: Boolean(connection),
    connectionRevision: connection?.revision ?? null,
    sharedProjectIds: connection ? readMcpSharedProjects(connection) : [],
  });
}

export async function presentMcpServer(context: ServiceContext, server: McpServerRecord) {
  const user = context.requireUser();
  const connection = await context.repositories.mcpRegistry.getConnection(server.id, user.id);
  let managed =
    !server.workspace_id &&
    authorise("owner.access", {
      actorId: String(user.id),
      ownerId: String(server.created_by_user_id),
    }).allowed;

  if (server.workspace_id) {
    const { role } = await requireWorkspaceAccess(context, server.workspace_id);

    managed = role === "owner" || role === "admin";
  }

  return formatMcpServer(server, connection, managed);
}
