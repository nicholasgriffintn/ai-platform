import { effectClassFromToolHints } from "@ngriffin_uk/polychat-library-tools";
import type { McpAppCallToolResult, McpAppToolCallRequest } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import {
  findMcpGatewayServer,
  listMcpGatewayTools,
  openMcpGatewaySession,
  resolveUserMcpGatewayServers,
} from "./mcp-gateway-servers";

export async function callMcpAppTool(
  context: ServiceContext,
  request: McpAppToolCallRequest,
): Promise<McpAppCallToolResult> {
  const server = findMcpGatewayServer(
    await resolveUserMcpGatewayServers(context),
    request.integration,
  );
  const session = await openMcpGatewaySession(context, server);
  const tool = (await listMcpGatewayTools(context, session)).find(
    (candidate) => candidate.name === request.tool,
  );

  if (!tool) {
    throw new AssistantError(
      `${server.label} does not offer "${request.tool}" here`,
      ErrorType.NOT_FOUND,
      404,
    );
  }

  const effectClass = effectClassFromToolHints({
    readOnly: tool.annotations?.readOnlyHint,
    destructive: tool.annotations?.destructiveHint,
  });

  if (effectClass !== "read") {
    throw new AssistantError(
      `"${request.tool}" can change something, so it only runs from the conversation, where it can ask you first`,
      ErrorType.AUTHORISATION_ERROR,
      403,
      { tool: request.tool },
    );
  }

  const result = await session.client.callTool(request.tool, request.arguments);

  return {
    content: result.content,
    ...(result.structuredContent !== undefined
      ? { structuredContent: result.structuredContent }
      : {}),
    ...(result.isError !== undefined ? { isError: result.isError } : {}),
  };
}
