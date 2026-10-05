import z from "zod/v4";

import type { McpProtocolRequest } from "../../src/mcp/client.js";

const requestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.string().min(1),
  method: z.enum(["server/discover", "tools/list", "tools/call"]),
  params: z.record(z.string(), z.unknown()),
});

export function readMcpFixtureRequest(request: McpProtocolRequest) {
  const parsed = requestSchema.parse(JSON.parse(request.body));
  const meta = z
    .object({
      "io.modelcontextprotocol/protocolVersion": z.literal("2026-07-28"),
      "io.modelcontextprotocol/clientCapabilities": z.object({}).strict(),
    })
    .parse(parsed.params._meta);

  if (
    request.headers.get("Mcp-Method") !== parsed.method ||
    request.headers.get("MCP-Protocol-Version") !==
      meta["io.modelcontextprotocol/protocolVersion"] ||
    request.headers.has("Mcp-Session-Id")
  ) {
    throw new Error("Request metadata does not match its headers");
  }

  return parsed;
}

export function mcpFixtureResult(request: McpProtocolRequest, result: Record<string, unknown>) {
  const parsed = readMcpFixtureRequest(request);

  return Response.json({
    jsonrpc: "2.0",
    id: parsed.id,
    result: { resultType: "complete", ...result },
  });
}

export function mcpFixtureHeaderValue(value: string | null): string | null {
  if (value?.startsWith("=?base64?") && value.endsWith("?=")) {
    return Buffer.from(value.slice(9, -2), "base64").toString("utf8");
  }

  return value;
}

export function mcpFixtureStream(
  request: McpProtocolRequest,
  result: Record<string, unknown>,
  chunkSize = 17,
) {
  const parsed = readMcpFixtureRequest(request);
  const bytes = new TextEncoder().encode(
    `: keep-alive\r\n\r\n` +
      `data: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/progress", params: { progress: 1 } })}\r\r` +
      `data: ${JSON.stringify({ jsonrpc: "2.0", id: parsed.id, result: { resultType: "complete", ...result } })}\r\n\n`,
  );
  let offset = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset < bytes.length) {
        controller.enqueue(bytes.slice(offset, offset + chunkSize));
        offset += chunkSize;
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  return {
    response: new Response(body, { headers: { "Content-Type": "text/event-stream" } }),
    isCancelled: () => cancelled,
  };
}

export function mcpFixtureWaitingResponse() {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(": waiting\n\n"));
    },
    cancel() {
      cancelled = true;
    },
  });

  return {
    response: new Response(body, { headers: { "Content-Type": "text/event-stream" } }),
    isCancelled: () => cancelled,
  };
}

export const fixtureMcpTool = {
  name: "préférences",
  inputSchema: {
    type: "object",
    properties: {
      message: { type: "string", "x-mcp-header": "Greeting" },
      settings: {
        type: "object",
        properties: { attempts: { type: "integer", "x-mcp-header": "Attempts" } },
        required: ["attempts"],
        additionalProperties: false,
      },
      colour: { type: "string", default: "blue" },
    },
    required: ["message", "settings"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "array",
    items: { $ref: "#/$defs/reply" },
    $defs: {
      reply: {
        type: "object",
        properties: { saved: { type: "boolean" } },
        required: ["saved"],
        additionalProperties: false,
      },
    },
  },
};
