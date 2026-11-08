import { readMcpToolAppEntry, type McpToolAppEntry } from "@ngriffin_uk/polychat-ai-integrations";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { McpAppEntryOpenRequest, McpAppView } from "@ngriffin_uk/polychat-schemas";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import {
  findMcpGatewayServer,
  listMcpGatewayTools,
  openMcpGatewaySession,
  readMcpGatewayAppResource,
  resolveUserMcpGatewayServers,
  toMcpAppCallToolResult,
} from "./mcp-gateway-servers";

const logger = getLogger({ prefix: "tools/mcp-app-entries" });

export interface McpAppEntry extends McpToolAppEntry {
  server: string;
}

export async function listMcpAppEntries(context: ServiceContext): Promise<McpAppEntry[]> {
  const servers = await resolveUserMcpGatewayServers(context);
  const results = await Promise.allSettled(
    servers.map(async (server) => {
      const session = await openMcpGatewaySession(context, server);

      return (await listMcpGatewayTools(context, session)).flatMap((tool) => {
        const entry = readMcpToolAppEntry(tool);

        return entry ? [{ ...entry, server: server.label }] : [];
      });
    }),
  );

  return results.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    logger.warn(`Apps from ${servers[index]?.label ?? "an MCP server"} could not be listed`, {
      error: getErrorMessage(result.reason),
    });

    return [];
  });
}

export async function openMcpAppEntry(
  context: ServiceContext,
  request: McpAppEntryOpenRequest,
): Promise<McpAppView> {
  const server = findMcpGatewayServer(
    await resolveUserMcpGatewayServers(context),
    request.integration,
  );
  const session = await openMcpGatewaySession(context, server);
  const tool = (await listMcpGatewayTools(context, session)).find(
    (candidate) => candidate.name === request.tool,
  );
  const entry = tool ? readMcpToolAppEntry(tool) : undefined;

  if (!entry) {
    throw new AssistantError(
      `${server.label} does not offer "${request.tool}" as an app`,
      ErrorType.NOT_FOUND,
      404,
    );
  }

  const [result, resource] = await Promise.all([
    session.client.callTool(entry.tool, {}),
    readMcpGatewayAppResource(context, session, entry.resourceUri),
  ]);

  if (!resource) {
    throw new AssistantError(
      `${server.label} did not return a view for ${entry.name}`,
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  return {
    integration: server.label,
    tool: entry.tool,
    uri: entry.resourceUri,
    html: resource.html,
    ui: resource.ui,
    arguments: {},
    result: toMcpAppCallToolResult(result),
  };
}
