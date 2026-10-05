import {
  nativeMcpToolResultSchema,
  type NativeMcpTool,
  type NativeMcpToolResult,
} from "@ngriffin_uk/polychat-schemas";
import {
  abortable,
  assertJsonComplexity,
  canonicalJson,
  generateId,
  isRecord,
} from "@ngriffin_uk/polychat-utility-core";
import { withAbortTimeout } from "@ngriffin_uk/polychat-utility-server/async";
import { createBoundedJsonSchemaValidator } from "@ngriffin_uk/polychat-utility-server/json";

import {
  readDiscoveredMcpTools,
  validateNativeMcpTool,
  type McpDiscoveredCatalogue,
} from "./catalogue.js";
import { McpProtocolError } from "./errors.js";
import { buildMcpHeaders } from "./headers.js";
import { readMcpResponse } from "./responses.js";

export const NATIVE_MCP_PROTOCOL_VERSION = "2026-07-28";

type McpMethod = "server/discover" | "tools/list" | "tools/call";

export interface McpProtocolRequest {
  method: McpMethod;
  body: string;
  headers: Headers;
  signal: AbortSignal;
}

export type McpRequestSender = (request: McpProtocolRequest) => Promise<Response>;

export class McpProtocolClient {
  constructor(
    private readonly sendRequest: McpRequestSender,
    private readonly signal: AbortSignal,
  ) {}

  async discoverTools(): Promise<McpDiscoveredCatalogue> {
    const discovery = await this.request("server/discover", {});

    if (
      !Array.isArray(discovery.supportedVersions) ||
      discovery.supportedVersions.length > 16 ||
      !discovery.supportedVersions.every((version) => typeof version === "string") ||
      !discovery.supportedVersions.includes(NATIVE_MCP_PROTOCOL_VERSION)
    ) {
      throw new McpProtocolError("unsupported_protocol");
    }

    if (!isRecord(discovery.capabilities) || !isRecord(discovery.capabilities.tools)) {
      throw new McpProtocolError("tools_unavailable");
    }

    const catalogue: McpDiscoveredCatalogue = { tools: [], rejectedTools: [] };
    const cursors = new Set<string>();
    const names = new Set<string>();
    let cursor: string | undefined;
    let count = 0;

    for (let page = 0; page < 5; page += 1) {
      const result = await this.request("tools/list", cursor ? { cursor } : {});

      if (
        !Array.isArray(result.tools) ||
        (result.nextCursor !== undefined &&
          (typeof result.nextCursor !== "string" ||
            !result.nextCursor.length ||
            result.nextCursor.length > 2048))
      ) {
        throw new McpProtocolError("invalid_response");
      }

      count += result.tools.length;

      if (count > 100) {
        throw new McpProtocolError("catalogue_limit");
      }

      await readDiscoveredMcpTools(result.tools, names, catalogue);
      cursor = typeof result.nextCursor === "string" ? result.nextCursor : undefined;

      if (!cursor) {
        return catalogue;
      }

      if (cursors.has(cursor)) {
        throw new McpProtocolError("catalogue_limit");
      }

      cursors.add(cursor);
    }

    throw new McpProtocolError("catalogue_limit");
  }

  async callTool(
    definition: NativeMcpTool,
    params: Record<string, unknown>,
  ): Promise<NativeMcpToolResult> {
    let tool: NativeMcpTool;
    let argumentsSnapshot: Record<string, unknown>;

    try {
      assertJsonComplexity(params);
      tool = validateNativeMcpTool(structuredClone(definition));
      argumentsSnapshot = structuredClone(params);
      const parsed = createBoundedJsonSchemaValidator(tool.inputSchema).safeParse(
        argumentsSnapshot,
      );

      if (!parsed.success || canonicalJson(parsed.data) !== canonicalJson(argumentsSnapshot)) {
        throw new McpProtocolError("invalid_arguments");
      }
    } catch {
      throw new McpProtocolError("invalid_arguments");
    }

    const response = await this.request(
      "tools/call",
      { name: tool.name, arguments: argumentsSnapshot },
      { name: tool.name, inputSchema: tool.inputSchema, params: argumentsSnapshot },
    );
    const result = nativeMcpToolResultSchema.safeParse(response);

    if (!result.success) {
      throw new McpProtocolError("invalid_response");
    }

    if (
      tool.outputSchema &&
      result.data.isError !== true &&
      !createBoundedJsonSchemaValidator(tool.outputSchema).safeParse(result.data.structuredContent)
        .success
    ) {
      throw new McpProtocolError("invalid_response");
    }

    return result.data;
  }

  private async request(
    method: McpMethod,
    params: Record<string, unknown>,
    tool?: { name: string; inputSchema: Record<string, unknown>; params: Record<string, unknown> },
  ): Promise<Record<string, unknown>> {
    try {
      this.signal.throwIfAborted();
      const id = generateId();
      const body = JSON.stringify({
        jsonrpc: "2.0",
        id,
        method,
        params: {
          ...params,
          _meta: {
            "io.modelcontextprotocol/protocolVersion": NATIVE_MCP_PROTOCOL_VERSION,
            "io.modelcontextprotocol/clientInfo": { name: "Polychat", version: "1.0.0" },
            "io.modelcontextprotocol/clientCapabilities": {},
          },
        },
      });

      if (new TextEncoder().encode(body).byteLength > 64 * 1024) {
        throw new McpProtocolError("invalid_arguments");
      }

      const headers = buildMcpHeaders(method, NATIVE_MCP_PROTOCOL_VERSION, tool);

      return await withAbortTimeout(async (timeoutSignal) => {
        const signal = AbortSignal.any([this.signal, timeoutSignal]);

        signal.throwIfAborted();
        const pending = this.sendRequest({ method, body, headers, signal }).then(
          async (response) => {
            if (signal.aborted) {
              await response.body?.cancel();
              signal.throwIfAborted();
            }

            return response;
          },
        );
        const response = await abortable(pending, signal);
        const result = await readMcpResponse(response, id, signal);

        if (response.status !== 200) {
          throw new McpProtocolError("request_failed");
        }

        signal.throwIfAborted();

        return result;
      }, 30_000);
    } catch (error) {
      throw error instanceof McpProtocolError ? error : new McpProtocolError("request_failed");
    }
  }
}
