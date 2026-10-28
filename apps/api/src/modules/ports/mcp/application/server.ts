import {
  JSON_RPC_ERRORS,
  type JsonRpcPayload,
  type JsonRpcResponse,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import {
  dispatchJsonRpcPayload,
  JsonRpcError,
  type JsonRpcHandlers,
} from "@ngriffin_uk/polychat-utility-server/json-rpc";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { callMcpPortTool, callWorkMcpTool, listMcpPortTools, listWorkMcpTools } from "./tools";
import { prefersEventStream, toEventStreamResponse } from "./transport";
import type { WorkRunAccess } from "./work-access";

export const MCP_SERVER_PROTOCOL_VERSION = "2025-06-18";
export const MCP_SERVER_INFO = { name: "polychat", version: "1.0.0" } as const;

export interface McpPortRequest {
  context: ServiceContext;
  payload: JsonRpcPayload;
  accept: string | null;
  appUrl: string;
}

function readCallParams(params: unknown): { name: string; arguments: unknown } {
  const record = isRecord(params) ? params : {};

  if (typeof record.name !== "string" || !record.name) {
    throw new JsonRpcError(JSON_RPC_ERRORS.invalidParams, "tools/call needs a tool name");
  }

  return { name: record.name, arguments: record.arguments };
}

function mcpHandlers(context: ServiceContext, appUrl: string): JsonRpcHandlers {
  return {
    initialize: () => ({
      protocolVersion: MCP_SERVER_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: MCP_SERVER_INFO,
      instructions:
        "Polychat's tools and the person's teammates, under the API key owner's authority. Tools that change shared state, send, spend or delete wait for approval in Polychat rather than running from here.",
    }),
    "notifications/initialized": () => undefined,
    ping: () => ({}),
    "tools/list": async () => ({ tools: await listMcpPortTools(context) }),
    "tools/call": (params) => callMcpPortTool(context, { ...readCallParams(params), appUrl }),
  };
}

function workMcpHandlers(
  context: ServiceContext,
  access: WorkRunAccess,
  appUrl: string,
): JsonRpcHandlers {
  return {
    initialize: () => ({
      protocolVersion: MCP_SERVER_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: MCP_SERVER_INFO,
      instructions:
        "Polychat Work for the task you are running: read and update tasks, post to their threads, raise cases and ask for review. Anything that needs a person waits in their Inbox.",
    }),
    "notifications/initialized": () => undefined,
    ping: () => ({}),
    "tools/list": () => ({ tools: listWorkMcpTools() }),
    "tools/call": (params) =>
      callWorkMcpTool(context, access, { ...readCallParams(params), appUrl }),
  };
}

async function respond(
  payload: JsonRpcPayload,
  accept: string | null,
  handlers: JsonRpcHandlers,
): Promise<JsonRpcResponse | JsonRpcResponse[] | Response | null> {
  const responses = await dispatchJsonRpcPayload(payload, handlers);

  if (responses.length === 0) {
    return null;
  }

  if (prefersEventStream(accept)) {
    return toEventStreamResponse(responses);
  }

  return Array.isArray(payload) ? responses : (responses[0] ?? null);
}

export function handleMcpRequest({
  context,
  payload,
  accept,
  appUrl,
}: McpPortRequest): Promise<JsonRpcResponse | JsonRpcResponse[] | Response | null> {
  return respond(payload, accept, mcpHandlers(context, appUrl));
}

export function handleWorkMcpRequest(
  request: McpPortRequest & { access: WorkRunAccess },
): Promise<JsonRpcResponse | JsonRpcResponse[] | Response | null> {
  return respond(
    request.payload,
    request.accept,
    workMcpHandlers(request.context, request.access, request.appUrl),
  );
}
