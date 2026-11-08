import { Client, ProtocolError, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import type z from "zod/v4";

import {
  mcpResourceContentSchema,
  mcpResourceReadResultSchema,
  mcpToolCallResultSchema,
  mcpToolListResultSchema,
  mcpToolSchema,
  type McpClient,
  type McpResourceContent,
  type McpTool,
  type McpToolCallResult,
} from "./contracts.js";
import { toMcpRequestError } from "./errors.js";
import { createMcpFetch } from "./mcp-fetch.js";
import {
  buildMcpParamHeaders,
  readMcpParamHeaders,
  type McpParamHeader,
} from "./mcp-param-headers.js";
import { parseMcpServerUrl } from "./server-url.js";

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TOOL_PAGES = 5;
const MAX_TOOLS = 200;
const SDK_TIMEOUT_DISABLED_MS = 2_147_483_647;
const HEADER_MISMATCH_CODE = -32020;

export interface McpHttpClientOptions {
  url: string;
  allowLoopback?: boolean;
  headers?: Readonly<Record<string, string>>;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  clientName?: string;
}

function isHeaderMismatch(error: unknown): boolean {
  return ProtocolError.isInstance(error) && error.code === HEADER_MISMATCH_CODE;
}

export class McpHttpClient implements McpClient {
  private readonly url: URL;
  private readonly headers: Readonly<Record<string, string>>;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly clientName: string;
  private readonly paramHeaders = new Map<string, readonly McpParamHeader[]>();
  private connection: Promise<Client> | undefined;

  constructor(options: McpHttpClientOptions) {
    this.url = parseMcpServerUrl(options.url, "connect", {
      allowLoopback: options.allowLoopback,
    });
    this.headers = options.headers ?? {};
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.clientName = options.clientName ?? "polychat";
  }

  async listTools(): Promise<McpTool[]> {
    const tools: McpTool[] = [];
    let cursor: string | undefined;

    try {
      const client = await this.connect();

      for (let page = 0; page < MAX_TOOL_PAGES && tools.length < MAX_TOOLS; page += 1) {
        const result = await this.send(
          client,
          "tools/list",
          cursor ? { cursor } : {},
          mcpToolListResultSchema,
        );

        for (const raw of result.tools) {
          const tool = mcpToolSchema.safeParse(raw);

          if (tool.success && this.acceptTool(client, tool.data)) {
            tools.push(tool.data);
          }
        }

        cursor = result.nextCursor;

        if (!cursor) {
          break;
        }
      }
    } catch (error) {
      throw toMcpRequestError(error, "tools/list");
    }

    return tools.slice(0, MAX_TOOLS);
  }

  async readResource(uri: string): Promise<McpResourceContent[]> {
    try {
      const result = await this.send(
        await this.connect(),
        "resources/read",
        { uri },
        mcpResourceReadResultSchema,
      );

      return result.contents.flatMap((raw) => {
        const content = mcpResourceContentSchema.safeParse(raw);

        return content.success ? [content.data] : [];
      });
    } catch (error) {
      throw toMcpRequestError(error, "resources/read");
    }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    try {
      const client = await this.connect();

      try {
        return await this.sendToolCall(client, name, args);
      } catch (error) {
        if (!isHeaderMismatch(error)) {
          throw error;
        }

        await this.listTools();

        return await this.sendToolCall(client, name, args);
      }
    } catch (error) {
      throw toMcpRequestError(error, name);
    }
  }

  private connect(): Promise<Client> {
    this.connection ??= this.openConnection().catch((error: unknown) => {
      this.connection = undefined;
      throw toMcpRequestError(error, "initialize");
    });

    return this.connection;
  }

  private async openConnection(): Promise<Client> {
    const client = new Client(
      { name: this.clientName, version: "1.0.0" },
      { versionNegotiation: { mode: "auto" }, inputRequired: { autoFulfill: false } },
    );
    const transport = new StreamableHTTPClientTransport(this.url, {
      fetch: createMcpFetch({ fetch: this.fetchImpl, timeoutMs: this.timeoutMs }),
      requestInit: { headers: { ...this.headers }, redirect: "manual" },
    });

    await client.connect(transport, { timeout: SDK_TIMEOUT_DISABLED_MS });

    return client;
  }

  private send<T extends z.ZodType>(
    client: Client,
    method: string,
    params: Record<string, unknown>,
    schema: T,
    headers?: Readonly<Record<string, string>>,
  ) {
    return client.request({ method, params }, schema, {
      timeout: SDK_TIMEOUT_DISABLED_MS,
      ...(headers ? { headers } : {}),
    });
  }

  private sendToolCall(
    client: Client,
    name: string,
    args: Record<string, unknown>,
  ): Promise<McpToolCallResult> {
    return this.send(
      client,
      "tools/call",
      { name, arguments: args },
      mcpToolCallResultSchema,
      buildMcpParamHeaders(this.paramHeaders.get(name) ?? [], args),
    );
  }

  private acceptTool(client: Client, tool: McpTool): boolean {
    if (client.getProtocolEra() !== "modern") {
      return true;
    }

    const headers = readMcpParamHeaders(tool.inputSchema);

    if (headers) {
      this.paramHeaders.set(tool.name, headers);
    }

    return headers !== null;
  }
}
