import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { mcpToolConfigurationSchema, type NativeMcpCall } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireScopedTeammateAccess } from "~/modules/teammates/application/access";
import { resolveTeammateMcpServers } from "~/modules/teammates/application/mcp-servers";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { readMcpCatalog, readMcpSharedProjects, requireMcpServer } from "./access";

export interface McpRunScope {
  projectId?: string;
  teammateContextId?: string;
  admittedServerIds?: readonly string[];
}

function rejectScope(): never {
  throw new AssistantError(
    "This MCP server is not available in the current scope",
    ErrorType.AUTHORISATION_ERROR,
    403,
  );
}

export async function requireMcpScope(
  context: ServiceContext,
  serverId: string,
  scope: McpRunScope,
) {
  const user = context.requireUser();
  const server = await requireMcpServer(context, serverId);
  const connection = await context.repositories.mcpRegistry.getConnection(serverId, user.id);

  if (
    !server.enabled ||
    !connection ||
    (scope.admittedServerIds && !scope.admittedServerIds.includes(serverId))
  ) {
    rejectScope();
  }

  if (scope.projectId) {
    const { project } = await requireProjectAccess(context, scope.projectId);

    if (
      server.workspace_id !== project.workspace_id ||
      !readMcpSharedProjects(connection).includes(project.id)
    ) {
      rejectScope();
    }

    if (!scope.teammateContextId) {
      const grants = await context.repositories.workspaces.listProjectCapabilities(project.id);
      const configurations = await context.repositories.capabilityConfigurations.list(
        { type: "project", id: project.id },
        "tool",
      );
      const configuration = mcpToolConfigurationSchema.safeParse(
        configurations.find((item) => item.capabilityId === "mcp")?.configuration,
      );

      if (
        !grants.some(
          (grant) => grant.kind === "tool" && grant.capability_id === "mcp" && !grant.excluded,
        ) ||
        !configuration.success ||
        !configuration.data.servers.some((candidate) => candidate.id === serverId)
      ) {
        rejectScope();
      }
    }
  }

  if (scope.teammateContextId) {
    const teammateContext = await context.repositories.teammateContexts.getById(
      scope.teammateContextId,
    );

    if (
      !teammateContext ||
      !ownsResource(user.id, teammateContext.actorUserId) ||
      teammateContext.status !== "active" ||
      (teammateContext.scope.type === "project"
        ? teammateContext.scope.id !== scope.projectId
        : Boolean(scope.projectId))
    ) {
      rejectScope();
    }

    const teammate = await requireScopedTeammateAccess(
      context,
      teammateContext.teammateId,
      teammateContext.scope,
      user.id,
    );

    if (
      !resolveTeammateMcpServers(teammate.servers).some((candidate) => candidate.id === serverId)
    ) {
      rejectScope();
    }
  }

  return { server, connection };
}

export async function requireMcpCall(
  context: ServiceContext,
  call: NativeMcpCall,
  scope: McpRunScope,
) {
  const authority = await requireMcpScope(context, call.serverId, scope);
  const tool = readMcpCatalog(authority.server).find(
    (candidate) =>
      candidate.name === call.operation && candidate.schemaDigest === call.schemaDigest,
  );

  if (!tool || tool.access === "disabled") {
    throw new AssistantError(
      "MCP tool access or schema changed. Discover the current tools.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return { ...authority, tool };
}
