import { McpProtocolClient } from "@ngriffin_uk/polychat-ai-integrations";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { presentMcpServer, readMcpCatalog, requireMcpServer } from "./access";
import { openMcpCredential } from "./credentials";
import { createMcpRequestSender, requireMcpSnapshot } from "./transport";

export async function discoverMcpServer(context: ServiceContext, id: string, revision: number) {
  const server = await requireMcpServer(context, id, true);
  const connection = await context.repositories.mcpRegistry.getConnection(
    id,
    context.requireUser().id,
  );

  if (!connection || server.revision !== revision) {
    throw new AssistantError(
      "Connect your account and refresh the server before discovery",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const requireScope = async () => {
    await requireMcpServer(context, id, true);
  };

  const credential = await openMcpCredential(context, server, connection);
  const client = new McpProtocolClient(
    createMcpRequestSender(context, server, connection, requireScope),
    AbortSignal.timeout(30_000),
  );
  const discovered = await client.discoverTools();
  const secret = credential.type === "none" ? undefined : credential.value;

  if (
    secret &&
    JSON.stringify(discovered.tools) !==
      JSON.stringify(redactSensitiveTokens(discovered.tools, secret))
  ) {
    throw new AssistantError(
      "MCP discovery returned sensitive content",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  await requireMcpSnapshot(context, server, connection, requireScope);
  const previous = readMcpCatalog(server);
  const tools = discovered.tools.map((tool) => ({
    ...tool,
    access:
      previous.find(
        (existing) => existing.name === tool.name && existing.schemaDigest === tool.schemaDigest,
      )?.access ?? tool.access,
  }));

  await context.repositories.mcpRegistry.updateServer(
    id,
    context.requireUser().id,
    revision,
    JSON.stringify(tools),
    Boolean(server.enabled),
  );

  return presentMcpServer(context, await requireMcpServer(context, id, true));
}
