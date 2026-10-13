import { McpHttpClient } from "@ngriffin_uk/polychat-ai-integrations";
import { normaliseMcpServerLabel } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { memoizeRequest } from "@ngriffin_uk/polychat-utility-server/request-cache";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { listMcpConnections, resolveMcpGatewayAccess } from "./mcp-connections";

const configuredServerSchema = z.object({
  server_label: z.string().min(1),
  server_url: z.string().min(1),
  credential_connection_id: z.string().min(1).optional(),
  allowed_tools: z.array(z.string()).optional(),
});

export interface McpGatewayServer {
  label: string;
  url: string;
  credentialConnectionId?: string;
  allowedTools?: string[];
}

export interface McpGatewaySession {
  server: McpGatewayServer;
  client: McpHttpClient;
  allowedTools: ReadonlySet<string> | null;
}

export function readMcpGatewayServers(value: unknown): McpGatewayServer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const parsed = configuredServerSchema.safeParse(entry);

    return parsed.success
      ? [
          {
            label: parsed.data.server_label,
            url: parsed.data.server_url,
            ...(parsed.data.credential_connection_id
              ? { credentialConnectionId: parsed.data.credential_connection_id }
              : {}),
            ...(parsed.data.allowed_tools ? { allowedTools: parsed.data.allowed_tools } : {}),
          },
        ]
      : [];
  });
}

export function findMcpGatewayServer(
  servers: readonly McpGatewayServer[],
  integration: string,
): McpGatewayServer {
  const wanted = normaliseMcpServerLabel(integration).toLowerCase();
  const server = servers.find(
    (candidate) => normaliseMcpServerLabel(candidate.label).toLowerCase() === wanted,
  );

  if (!server) {
    const names = servers.map((candidate) => `"${candidate.label}"`).join(", ");

    throw new AssistantError(
      names
        ? `No MCP integration is called "${integration}". Connected integrations: ${names}.`
        : "No MCP integrations are configured for this conversation.",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return server;
}

export function openMcpGatewaySession(
  context: ServiceContext,
  server: McpGatewayServer,
): Promise<McpGatewaySession> {
  return memoizeRequest(
    context.requestCache,
    `mcp-gateway:${server.label}:${server.url}`,
    async () => {
      const access = server.credentialConnectionId
        ? await resolveMcpGatewayAccess(context, {
            connectionId: server.credentialConnectionId,
            url: server.url,
            allowedTools: server.allowedTools,
          })
        : { headers: {}, allowedTools: server.allowedTools ?? null };

      return {
        server,
        client: new McpHttpClient({ url: server.url, headers: access.headers }),
        allowedTools: access.allowedTools ? new Set(access.allowedTools) : null,
      };
    },
  );
}

const HOSTED_MCP_TOOL_ID = "mcp";
const NATIVE_MCP_TOOL_NAMES = ["mcp_list_tools", "mcp_call_tool"] as const;

export function mergeNativeMcpToolNames(params: {
  enabledTools: string[] | undefined;
  useNativeGateway: boolean;
}): string[] | undefined {
  if (!params.enabledTools?.includes(HOSTED_MCP_TOOL_ID) || !params.useNativeGateway) {
    return params.enabledTools;
  }

  return [
    ...new Set([
      ...params.enabledTools.filter((tool) => tool !== HOSTED_MCP_TOOL_ID),
      ...NATIVE_MCP_TOOL_NAMES,
    ]),
  ];
}

export async function shouldUseNativeMcpGateway(params: {
  context: ServiceContext | undefined;
  enabledTools: readonly string[] | undefined;
  servers: readonly McpGatewayServer[];
  supportsHostedMcp: boolean;
}): Promise<boolean> {
  if (!params.enabledTools?.includes(HOSTED_MCP_TOOL_ID) || params.servers.length === 0) {
    return false;
  }

  if (!params.supportsHostedMcp) {
    return true;
  }

  const connectionIds = new Set(
    params.servers.flatMap((server) =>
      server.credentialConnectionId ? [server.credentialConnectionId] : [],
    ),
  );

  if (connectionIds.size === 0 || !params.context?.user?.id) {
    return false;
  }

  const { connections } = await listMcpConnections(params.context);

  return connections.some(
    (connection) => connectionIds.has(connection.id) && connection.credentialRecipient !== "openai",
  );
}
