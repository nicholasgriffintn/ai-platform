import {
  McpHttpClient,
  readMcpAppUiMeta,
  type McpResourceContent,
  type McpTool,
} from "@ngriffin_uk/polychat-ai-integrations";
import {
  MCP_APP_MAX_HTML_BYTES,
  MCP_APP_MIME_TYPE,
  mcpAppUiMetaSchema,
  normaliseMcpServerLabel,
  type McpAppUiMeta,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { memoizeRequest } from "@ngriffin_uk/polychat-utility-server/request-cache";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { CapabilityConfigurationRepository } from "~/modules/capabilities/infrastructure/CapabilityConfigurationRepository";

import { listMcpConnections, resolveMcpGatewayAccess } from "./mcp-connections";
import { resolveModelToolConfigurations } from "./modelToolConfiguration";

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

export function listMcpGatewayTools(
  context: ServiceContext,
  session: McpGatewaySession,
): Promise<McpTool[]> {
  return memoizeRequest(
    context.requestCache,
    `mcp-gateway-tools:${session.server.label}:${session.server.url}`,
    async () =>
      (await session.client.listTools()).filter(
        (tool) => !session.allowedTools || session.allowedTools.has(tool.name),
      ),
  );
}

export interface McpGatewayAppResource {
  uri: string;
  html: string;
  ui: McpAppUiMeta;
}

function decodeResourceHtml(content: McpResourceContent): string | undefined {
  if (typeof content.text === "string") {
    return content.text;
  }

  if (typeof content.blob === "string") {
    try {
      return new TextDecoder().decode(Uint8Array.from(atob(content.blob), (c) => c.charCodeAt(0)));
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function readMcpGatewayAppResource(
  context: ServiceContext,
  session: McpGatewaySession,
  uri: string,
): Promise<McpGatewayAppResource | null> {
  return memoizeRequest(
    context.requestCache,
    `mcp-gateway-app:${session.server.label}:${session.server.url}:${uri}`,
    async () => {
      const content = (await session.client.readResource(uri)).find(
        (item) => item.mimeType === MCP_APP_MIME_TYPE,
      );
      const html = content ? decodeResourceHtml(content) : undefined;

      if (!content || !html || new TextEncoder().encode(html).byteLength > MCP_APP_MAX_HTML_BYTES) {
        return null;
      }

      const ui = mcpAppUiMetaSchema.safeParse(readMcpAppUiMeta(content));

      return { uri, html, ui: ui.success ? ui.data : {} };
    },
  );
}

export async function resolveUserMcpGatewayServers(
  context: ServiceContext,
): Promise<McpGatewayServer[]> {
  const configurations = await context.repositories
    .get(CapabilityConfigurationRepository)
    .list({ type: "user", id: context.requireUser().id }, "tool");

  return readMcpGatewayServers(
    resolveModelToolConfigurations(
      configurations.map((configuration) => ({
        toolId: configuration.capabilityId,
        configuration: configuration.configuration,
      })),
    ).toolOptions?.mcp_servers,
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

  const { data: connections } = await listMcpConnections(params.context);

  return connections.some(
    (connection) => connectionIds.has(connection.id) && connection.credentialRecipient !== "openai",
  );
}
