import type { McpRequestSender } from "@ngriffin_uk/polychat-ai-integrations";
import { nativeMcpEndpointSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import type { McpConnectionRecord, McpServerRecord } from "../infrastructure/McpRegistryRepository";
import { requireMcpServer } from "./access";
import { openMcpCredential } from "./credentials";

export async function requireMcpSnapshot(
  context: ServiceContext,
  server: McpServerRecord,
  connection: McpConnectionRecord,
  requireScope: () => Promise<void>,
) {
  await requireScope();
  const current = await requireMcpServer(context, server.id);
  const ownConnection = await context.repositories.mcpRegistry.getConnection(
    server.id,
    context.requireUser().id,
  );

  if (
    current.endpoint !== server.endpoint ||
    current.revision !== server.revision ||
    !ownConnection ||
    ownConnection.id !== connection.id ||
    ownConnection.revision !== connection.revision
  ) {
    throw new AssistantError(
      "MCP authority changed. Start a new action.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return { server: current, connection: ownConnection };
}

export function createMcpRequestSender(
  context: ServiceContext,
  server: McpServerRecord,
  connection: McpConnectionRecord,
  requireScope: () => Promise<void>,
): McpRequestSender {
  return async (request) => {
    const snapshot = await requireMcpSnapshot(context, server, connection, requireScope);
    const endpoint = nativeMcpEndpointSchema.parse(snapshot.server.endpoint);
    const credential = await openMcpCredential(context, snapshot.server, snapshot.connection);
    const headers = new Headers(request.headers);

    if (credential.type === "bearer") {
      headers.set("Authorization", `Bearer ${credential.value}`);
    } else if (credential.type === "api-key") {
      headers.set("X-API-Key", credential.value);
    }

    request.signal.throwIfAborted();
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: request.body,
      redirect: "error",
      signal: request.signal,
    });

    try {
      await requireMcpSnapshot(context, server, connection, requireScope);

      return response;
    } catch (error) {
      await response.body?.cancel().catch(() => undefined);
      throw error;
    }
  };
}
