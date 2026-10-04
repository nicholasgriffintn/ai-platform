import type { IntegrationTool } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

const rpcRequestSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

interface McpTestServerState {
  tools: IntegrationTool[];
  calls: Array<{ name: string; arguments: unknown }>;
  requests: Array<{ url: string; authorization: string | null }>;
  result: {
    content: Array<{ type: "text"; text: string }>;
    structuredContent: Record<string, unknown>;
  };
  failCall: boolean;
  useSse: boolean;
  nextCursor?: string;
  beforeList?: () => Promise<void>;
}

export function createMcpTestServer(initialTools: IntegrationTool[]) {
  const state: McpTestServerState = {
    tools: initialTools,
    calls: [],
    requests: [],
    result: { content: [{ type: "text", text: "Completed" }], structuredContent: { ok: true } },
    failCall: false,
    useSse: false,
  };

  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString();

    state.requests.push({ url, authorization: new Headers(init?.headers).get("authorization") });

    if (init?.method !== "POST") {
      return new Response(null, { status: 405 });
    }

    if (typeof init.body !== "string") {
      throw new Error("Expected a JSON request body");
    }

    const rpc = rpcRequestSchema.parse(JSON.parse(init.body));
    const respond = (result: unknown) => Response.json({ jsonrpc: "2.0", id: rpc.id, result });

    if (rpc.method === "server/discover") {
      return Response.json({
        jsonrpc: "2.0",
        id: rpc.id,
        error: { code: -32601, message: "Legacy MCP server" },
      });
    }

    if (rpc.method === "initialize") {
      return respond({
        protocolVersion: rpc.params?.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: "Test service", version: "1.0.0" },
      });
    }

    if (rpc.method.startsWith("notifications/")) {
      return new Response(null, { status: 202 });
    }

    if (rpc.method === "tools/list") {
      await state.beforeList?.();

      return respond({
        tools: state.tools,
        ...(state.nextCursor ? { nextCursor: state.nextCursor } : {}),
      });
    }

    if (rpc.method === "tools/call") {
      const call = z.object({ name: z.string(), arguments: z.unknown() }).parse(rpc.params);

      state.calls.push(call);

      if (state.failCall) {
        throw new Error("Connection lost after service accepted action");
      }

      if (state.useSse) {
        return new Response(
          `event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result: state.result })}\n\n`,
          { headers: { "content-type": "text/event-stream" } },
        );
      }

      return respond(state.result);
    }

    throw new Error(`Unexpected MCP method: ${rpc.method}`);
  };

  return { state, fetch };
}
