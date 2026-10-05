import {
  createNativeMcpServerSchema,
  updateNativeMcpServerSchema,
  connectNativeMcpServerSchema,
  type CreateNativeMcpServer,
  type UpdateNativeMcpServer,
  type ConnectNativeMcpServer,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  requireProjectAccess,
  requireWorkspaceAccess,
} from "~/modules/workspaces/application/access";

import { formatMcpServer, presentMcpServer, readMcpCatalog, requireMcpServer } from "./access";
import { sealMcpCredential } from "./credentials";

export async function listMcpServers(context: ServiceContext, workspaceId?: string) {
  const user = context.requireUser();

  const access = workspaceId ? await requireWorkspaceAccess(context, workspaceId) : undefined;
  const [servers, connections] = await Promise.all([
    context.repositories.mcpRegistry.listServers(user.id, workspaceId),
    context.repositories.mcpRegistry.listConnections(user.id, workspaceId),
  ]);
  const managed = !workspaceId || access?.role === "owner" || access?.role === "admin";

  return {
    servers: servers.map((server) =>
      formatMcpServer(
        server,
        connections.find((connection) => connection.server_id === server.id),
        managed,
      ),
    ),
  };
}

export async function createMcpServer(context: ServiceContext, input: CreateNativeMcpServer) {
  const parsed = createNativeMcpServerSchema.parse(input);

  if (parsed.workspaceId) {
    await requireWorkspaceAccess(context, parsed.workspaceId, ["owner", "admin"]);
  }

  const id = await context.repositories.mcpRegistry.createServer({
    ...parsed,
    userId: context.requireUser().id,
  });

  return presentMcpServer(context, await requireMcpServer(context, id));
}

export async function updateMcpServer(
  context: ServiceContext,
  id: string,
  input: UpdateNativeMcpServer,
) {
  const parsed = updateNativeMcpServerSchema.parse(input);
  const server = await requireMcpServer(context, id, true);
  const catalog = readMcpCatalog(server);

  if (
    new Set(parsed.tools.map((tool) => tool.name)).size !== parsed.tools.length ||
    parsed.tools.length !== catalog.length
  ) {
    throw new AssistantError(
      "Select an access policy for every discovered tool",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const updated = catalog.map((tool) => {
    const policy = parsed.tools.find(
      (candidate) => candidate.name === tool.name && candidate.schemaDigest === tool.schemaDigest,
    );

    if (!policy) {
      throw new AssistantError(
        "MCP schemas changed. Refresh before approving tools.",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    return { ...tool, access: policy.access };
  });

  await context.repositories.mcpRegistry.updateServer(
    id,
    context.requireUser().id,
    parsed.revision,
    JSON.stringify(updated),
    parsed.enabled,
  );

  return presentMcpServer(context, await requireMcpServer(context, id));
}

export async function deleteMcpServer(context: ServiceContext, id: string, revision: number) {
  await requireMcpServer(context, id, true);
  await context.repositories.mcpRegistry.deleteServer(id, context.requireUser().id, revision);

  return { success: true };
}

export async function connectMcpServer(
  context: ServiceContext,
  id: string,
  input: ConnectNativeMcpServer,
) {
  const parsed = connectNativeMcpServerSchema.parse(input);
  const server = await requireMcpServer(context, id);
  const user = context.requireUser();

  for (const projectId of parsed.sharedProjectIds) {
    const { project } = await requireProjectAccess(context, projectId);

    if (!server.workspace_id || project.workspace_id !== server.workspace_id) {
      throw new AssistantError(
        "MCP result sharing requires a project in the server's workspace",
        ErrorType.AUTHORISATION_ERROR,
        403,
      );
    }
  }

  const existing = await context.repositories.mcpRegistry.getConnection(id, user.id);
  const connectionId = existing?.id ?? generateId();
  const encryptedCredential = await sealMcpCredential(
    context,
    server,
    { id: connectionId, user_id: user.id },
    parsed.credential,
  );

  await context.repositories.mcpRegistry.saveConnection({
    serverId: id,
    userId: user.id,
    id: connectionId,
    serverRevision: server.revision,
    previousRevision: existing?.revision,
    encryptedCredential,
    sharedProjects: JSON.stringify(parsed.sharedProjectIds),
  });

  return presentMcpServer(context, await requireMcpServer(context, id));
}

export async function disconnectMcpServer(context: ServiceContext, id: string) {
  context.requireUser();
  await context.repositories.mcpRegistry.deleteConnection(id, context.requireUser().id);

  return { success: true };
}
