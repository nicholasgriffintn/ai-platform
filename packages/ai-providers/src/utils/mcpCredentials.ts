import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ProviderRequestContext } from "../env.js";
import type { ProviderHost } from "../host.js";
import type { ChatCompletionParameters } from "../types/index.js";

export const MCP_CREDENTIAL_GATEWAY_HEADERS = {
  "cf-aig-collect-log": "false",
  "cf-aig-collect-log-payload": "false",
  "cf-aig-skip-cache": "true",
  "cf-aig-cache-ttl": "0",
};

export function hasMcpCredentialReferences(params: ChatCompletionParameters): boolean {
  const options = params.tool_options;

  return [params.tools, options?.mcp_servers, options?.responses_tools].some(
    (items) =>
      Array.isArray(items) &&
      items.some((item) => isRecord(item) && typeof item.credential_connection_id === "string"),
  );
}

export function getHostedMcpAuthorizations(body: Record<string, unknown>): string[] {
  return Array.isArray(body.tools)
    ? body.tools
        .flatMap((tool) =>
          isRecord(tool) && tool.type === "mcp" && typeof tool.authorization === "string"
            ? [tool.authorization]
            : [],
        )
        .sort((first, second) => second.length - first.length)
    : [];
}

export async function resolveHostedMcpCredentials(
  body: Record<string, unknown>,
  host: Pick<ProviderHost, "mcp">,
  provider: string,
  context?: ProviderRequestContext,
): Promise<Record<string, unknown>> {
  if (!Array.isArray(body.tools)) {
    return body;
  }

  const tools = [];

  for (const tool of body.tools) {
    if (!isRecord(tool) || tool.type !== "mcp" || tool.credential_connection_id === undefined) {
      tools.push(tool);
      continue;
    }

    if (
      !host.mcp ||
      !context?.user ||
      typeof tool.credential_connection_id !== "string" ||
      typeof tool.server_url !== "string" ||
      !tool.credential_connection_id
    ) {
      throw new AssistantError(
        "Authenticated MCP needs a saved connection",
        ErrorType.CONFIGURATION_ERROR,
        403,
      );
    }

    const allowed = tool.allowed_tools;

    if (
      allowed !== undefined &&
      (!Array.isArray(allowed) ||
        !allowed.every((name): name is string => typeof name === "string"))
    ) {
      throw new AssistantError("MCP tool allowlist is invalid", ErrorType.PARAMS_ERROR, 400);
    }

    const credential = await host.mcp.resolveCredential(context, {
      connectionId: tool.credential_connection_id,
      url: tool.server_url,
      provider,
      ...(allowed === undefined ? {} : { allowedTools: allowed }),
    });
    const {
      credential_connection_id: _connectionId,
      headers: _headers,
      authorization: _authorization,
      ...definition
    } = tool;

    tools.push({
      ...definition,
      authorization: credential.authorization,
      allowed_tools: credential.allowedTools,
      require_approval: "always",
    });
  }

  return { ...body, tools };
}
