import {
  ResponseBodyTooLargeError,
  readResponseTextWithinLimit,
} from "@ngriffin_uk/polychat-utility-server/http";

import {
  MCP_PROTOCOL_VERSION,
  mcpToolCallResultSchema,
  mcpToolListResultSchema,
  mcpToolSchema,
  type McpTool,
  type McpToolCallResult,
} from "./contracts.js";
import { McpRequestError } from "./errors.js";
import { readJsonRpcResponse } from "./rpc-response.js";
import { parseMcpServerUrl } from "./server-url.js";

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_TOOL_PAGES = 5;
const MAX_TOOLS = 200;

export interface McpHttpClientOptions {
  url: string;
  headers?: Readonly<Record<string, string>>;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  clientName?: string;
}

export class McpHttpClient {
  private readonly url: URL;
  private readonly headers: Readonly<Record<string, string>>;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly clientName: string;
  private sessionId: string | undefined;
  private initialised: Promise<void> | undefined;
  private nextId = 1;

  constructor(options: McpHttpClientOptions) {
    this.url = parseMcpServerUrl(options.url);
    this.headers = options.headers ?? {};
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.clientName = options.clientName ?? "polychat";
  }

  async listTools(): Promise<McpTool[]> {
    await this.initialise();

    const tools: McpTool[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < MAX_TOOL_PAGES && tools.length < MAX_TOOLS; page += 1) {
      const result = mcpToolListResultSchema.safeParse(
        await this.request("tools/list", cursor ? { cursor } : {}, "tools/list"),
      );

      if (!result.success) {
        throw this.invalidResponse("tools/list");
      }

      for (const raw of result.data.tools) {
        const tool = mcpToolSchema.safeParse(raw);

        if (tool.success) {
          tools.push(tool.data);
        }
      }

      cursor = result.data.nextCursor;

      if (!cursor) {
        break;
      }
    }

    return tools.slice(0, MAX_TOOLS);
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    await this.initialise();

    const result = mcpToolCallResultSchema.safeParse(
      await this.request("tools/call", { name, arguments: args }, name),
    );

    if (!result.success) {
      throw this.invalidResponse(name);
    }

    return result.data;
  }

  private initialise(): Promise<void> {
    this.initialised ??= (async () => {
      await this.request(
        "initialize",
        {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: this.clientName, version: "1.0.0" },
        },
        "initialize",
      );

      try {
        await this.send({ jsonrpc: "2.0", method: "notifications/initialized" }, "initialize");
      } catch {
        return;
      }
    })().catch((error: unknown) => {
      this.initialised = undefined;
      throw error;
    });

    return this.initialised;
  }

  private async request(method: string, params: unknown, operation: string): Promise<unknown> {
    const id = this.nextId++;
    const response = await this.send({ jsonrpc: "2.0", id, method, params }, operation);
    let body: string;

    try {
      body = await readResponseTextWithinLimit(response, MAX_RESPONSE_BYTES);
    } catch (error) {
      throw new McpRequestError({
        code: "invalid_response",
        operation,
        message:
          error instanceof ResponseBodyTooLargeError
            ? "The MCP server returned more data than one call can carry."
            : "The MCP server response could not be read.",
        requestSent: true,
      });
    }

    const message = readJsonRpcResponse(body, response.headers.get("content-type"), id);

    if (!message) {
      throw this.invalidResponse(operation);
    }

    if (message.error) {
      throw new McpRequestError({
        code: "rpc_error",
        operation,
        message: message.error.message ?? "The MCP server rejected the request.",
        requestSent: true,
      });
    }

    return message.result;
  }

  private async send(payload: Record<string, unknown>, operation: string): Promise<Response> {
    let response: Response;

    try {
      response = await this.fetchImpl(this.url.toString(), {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: {
          ...this.headers,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
          ...(this.sessionId ? { "Mcp-Session-Id": this.sessionId } : {}),
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";

      throw new McpRequestError({
        code: timedOut ? "timeout" : "network_error",
        operation,
        message: timedOut
          ? "The MCP server did not answer in time."
          : "The MCP server could not be reached.",
        requestSent: timedOut,
      });
    }

    this.sessionId = response.headers.get("mcp-session-id") ?? this.sessionId;

    if (response.status === 401 || response.status === 403) {
      throw new McpRequestError({
        code: "unauthorised",
        operation,
        status: response.status,
        message: "The MCP server rejected the credentials. Reconnect it and try again.",
        requestSent: true,
      });
    }

    if (!response.ok && response.status !== 202) {
      throw new McpRequestError({
        code: "http_error",
        operation,
        status: response.status,
        message: `The MCP server answered with HTTP ${response.status}.`,
        requestSent: true,
      });
    }

    return response;
  }

  private invalidResponse(operation: string): McpRequestError {
    return new McpRequestError({
      code: "invalid_response",
      operation,
      message: "The MCP server returned a response that is not valid MCP.",
      requestSent: true,
    });
  }
}
