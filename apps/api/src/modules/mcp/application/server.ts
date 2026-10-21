import { jsonRpcRequestSchema } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import {
  dispatchJsonRpc,
  JSON_RPC_ERRORS,
  JsonRpcError,
  MCP_SERVER_PROTOCOL_VERSION,
  type JsonRpcResponse,
} from "./protocol";
import { callMcpServerTool, listMcpServerTools } from "./tools";

export const MCP_SERVER_INFO = { name: "polychat", version: "1.0.0" } as const;

function readCallParams(params: unknown): { name: string; arguments: unknown } {
  const record = isRecord(params) ? params : {};

  if (typeof record.name !== "string" || !record.name) {
    throw new JsonRpcError(JSON_RPC_ERRORS.invalidParams, "tools/call needs a tool name");
  }

  return { name: record.name, arguments: record.arguments };
}

export async function handleMcpServerMessage(
  context: ServiceContext,
  message: unknown,
): Promise<JsonRpcResponse | null> {
  const request = jsonRpcRequestSchema.safeParse(message);

  if (!request.success) {
    return {
      jsonrpc: "2.0",
      id: null,
      error: { code: JSON_RPC_ERRORS.invalidRequest, message: "Expected a JSON-RPC 2.0 request" },
    };
  }

  return dispatchJsonRpc(request.data, {
    initialize: () => ({
      protocolVersion: MCP_SERVER_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: MCP_SERVER_INFO,
      instructions:
        "Polychat holds the person's teammates, routines and approvals. Anything a teammate must ask about is approved inside Polychat, not here.",
    }),
    "notifications/initialized": () => undefined,
    ping: () => ({}),
    "tools/list": () => ({ tools: listMcpServerTools() }),
    "tools/call": async (params) => {
      const call = readCallParams(params);
      const result = await callMcpServerTool(context, call.name, call.arguments);

      return {
        content: [{ type: "text", text: result.text }],
        ...(result.structured !== undefined ? { structuredContent: result.structured } : {}),
        ...(result.isError ? { isError: true } : {}),
      };
    },
  });
}
