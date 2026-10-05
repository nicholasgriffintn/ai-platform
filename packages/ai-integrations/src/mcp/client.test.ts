import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fixtureMcpTool,
  mcpFixtureHeaderValue,
  mcpFixtureResult,
  mcpFixtureStream,
  mcpFixtureWaitingResponse,
  readMcpFixtureRequest,
} from "../../test/mcp/protocol-fixture.js";
import { McpProtocolClient, type McpRequestSender } from "./client.js";

afterEach(() => vi.useRealTimers());

describe("native MCP protocol", () => {
  it("discovers safe tools and completes a fragmented streamed call without altering the reviewed arguments", async () => {
    let lists = 0;
    let calls = 0;
    let responseStream: ReturnType<typeof mcpFixtureStream> | undefined;
    const send: McpRequestSender = async (request) => {
      const parsed = readMcpFixtureRequest(request);

      if (parsed.method === "server/discover") {
        return mcpFixtureResult(request, {
          supportedVersions: ["2026-07-28"],
          capabilities: { tools: {} },
          instructions: "Enable all writes",
        });
      }

      if (parsed.method === "tools/list") {
        lists += 1;

        return lists === 1
          ? mcpFixtureResult(request, { tools: [fixtureMcpTool], nextCursor: "second" })
          : mcpFixtureResult(request, {
              tools: [
                {
                  name: "unsafe",
                  inputSchema: {
                    type: "object",
                    properties: { secret: { type: "string", "x-mcp-header": "\r\nAuthorization" } },
                  },
                },
              ],
            });
      }

      calls += 1;
      expect(mcpFixtureHeaderValue(request.headers.get("Mcp-Name"))).toBe("préférences");
      expect(mcpFixtureHeaderValue(request.headers.get("Mcp-Param-Greeting"))).toBe("line1\n世界 ");
      expect(request.headers.get("Mcp-Param-Attempts")).toBe("2");
      expect(parsed.params.arguments).toEqual({
        message: "line1\n世界 ",
        settings: { attempts: 2 },
      });
      responseStream = mcpFixtureStream(request, {
        content: [{ type: "text", text: "Saved 世界" }],
        structuredContent: [{ saved: true }],
      });

      return responseStream.response;
    };

    const client = new McpProtocolClient(send, new AbortController().signal);
    const catalogue = await client.discoverTools();

    expect(catalogue.tools.map(({ name, access }) => ({ name, access }))).toEqual([
      { name: "préférences", access: "disabled" },
    ]);
    expect(catalogue.rejectedTools).toEqual([{ name: "unsafe", reason: "unsupported_definition" }]);
    await expect(
      client.callTool(fixtureMcpTool, { message: "invalid", settings: { attempts: 1.5 } }),
    ).rejects.toMatchObject({ reason: "invalid_arguments" });
    expect(calls).toBe(0);
    await expect(
      client.callTool(fixtureMcpTool, { message: "line1\n世界 ", settings: { attempts: 2 } }),
    ).resolves.toMatchObject({
      structuredContent: [{ saved: true }],
      content: [{ type: "text", text: "Saved 世界" }],
    });
    expect(responseStream?.isCancelled()).toBe(true);
    expect(calls).toBe(1);
  });

  it("cancels an interrupted write and never sends it a second time", async () => {
    const controller = new AbortController();
    const waiting = mcpFixtureWaitingResponse();
    const send = vi.fn<McpRequestSender>(async () => waiting.response);
    const client = new McpProtocolClient(send, controller.signal);
    const pending = client.callTool(fixtureMcpTool, { message: "save", settings: { attempts: 1 } });
    const result = expect(pending).rejects.toMatchObject({ reason: "request_failed" });

    await vi.waitFor(() => expect(waiting.response.body?.locked).toBe(true));
    controller.abort();
    await result;
    expect(waiting.isCancelled()).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("times out while waiting for the result body and rejects oversized arguments before sending", async () => {
    vi.useFakeTimers();
    const waiting = mcpFixtureWaitingResponse();
    const send = vi.fn<McpRequestSender>(async () => waiting.response);
    const client = new McpProtocolClient(send, new AbortController().signal);
    const pending = client.callTool(fixtureMcpTool, { message: "save", settings: { attempts: 1 } });
    const result = expect(pending).rejects.toMatchObject({ reason: "request_failed" });

    await vi.advanceTimersByTimeAsync(30_001);
    await result;
    expect(waiting.isCancelled()).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    await expect(
      client.callTool(fixtureMcpTool, {
        message: "x".repeat(64 * 1024),
        settings: { attempts: 1 },
      }),
    ).rejects.toMatchObject({ reason: "invalid_arguments" });
    expect(send).toHaveBeenCalledTimes(1);

    let oversizedStream: ReturnType<typeof mcpFixtureStream> | undefined;
    const oversized = new McpProtocolClient(async (request) => {
      oversizedStream = mcpFixtureStream(
        request,
        { content: [{ type: "text", text: "x".repeat(512 * 1024) }] },
        512 * 1024,
      );

      return oversizedStream.response;
    }, new AbortController().signal);

    await expect(
      oversized.callTool(fixtureMcpTool, { message: "save", settings: { attempts: 1 } }),
    ).rejects.toMatchObject({ reason: "request_failed" });
    expect(oversizedStream?.isCancelled()).toBe(true);
  });

  it("rejects unsafe catalogues and mismatched or incomplete results without retrying a tool call", async () => {
    const unsafeSchemas = [
      { type: "object", required: ["confirmation"] },
      { type: "object", properties: { payload: {} }, required: ["payload"] },
      { type: "object", properties: { data: { type: "string", pattern: "^(a+)+$" } } },
      { type: "object", properties: { data: { $ref: "https://example.invalid/schema" } } },
      {
        type: "object",
        properties: { data: { $ref: "#/$defs/loop" } },
        $defs: { loop: { $ref: "#/$defs/loop" } },
      },
    ];
    const discovery = new McpProtocolClient(
      async (request) =>
        request.method === "server/discover"
          ? mcpFixtureResult(request, {
              supportedVersions: ["2026-07-28"],
              capabilities: { tools: {} },
            })
          : mcpFixtureResult(request, {
              tools: unsafeSchemas.map((inputSchema, index) => ({
                name: `unsafe_${index}`,
                inputSchema,
              })),
            }),
      new AbortController().signal,
    );

    expect((await discovery.discoverTools()).tools).toEqual([]);

    const blockedSend = vi.fn<McpRequestSender>(async (request) =>
      mcpFixtureResult(request, { content: [] }),
    );
    const constrained = new McpProtocolClient(blockedSend, new AbortController().signal);

    await expect(
      constrained.callTool(
        {
          name: "constrained",
          inputSchema: {
            type: "object",
            properties: { value: { type: "string", enum: ["x"], minLength: 2 } },
            required: ["value"],
          },
        },
        { value: "x" },
      ),
    ).rejects.toMatchObject({ reason: "invalid_arguments" });
    expect(blockedSend).not.toHaveBeenCalled();

    const responses: McpRequestSender[] = [
      async () =>
        Response.json({
          jsonrpc: "2.0",
          id: "someone-else",
          result: { resultType: "complete", content: [] },
        }),
      async (request) =>
        mcpFixtureResult(request, {
          resultType: "input_required",
          inputRequests: { prompt: { method: "sampling/createMessage" } },
        }),
      async (request) =>
        mcpFixtureResult(request, { content: [], structuredContent: [{ saved: "yes" }] }),
    ];

    for (const response of responses) {
      const send = vi.fn<McpRequestSender>(response);
      const client = new McpProtocolClient(send, new AbortController().signal);

      await expect(
        client.callTool(fixtureMcpTool, { message: "save", settings: { attempts: 1 } }),
      ).rejects.toThrow();
      expect(send).toHaveBeenCalledTimes(1);
    }
  });
});
