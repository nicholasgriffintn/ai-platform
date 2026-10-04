import { afterEach, describe, expect, it, vi } from "vitest";

import { createMcpTestServer } from "../../test/mcp-server.js";
import { discoverNativeMcpSnapshot, executeNativeMcpOperation } from "./client.js";
import { createNativeMcpFetch } from "./http.js";
import { createIntegrationSnapshot } from "./snapshots.js";

afterEach(() => vi.unstubAllGlobals());

const settings = {
  endpoint: "https://tools.example.com/mcp",
  authentication: "bearer",
  token: "private-test-credential",
} as const;
const action = {
  name: "publish",
  inputSchema: { type: "object", properties: { report: { type: "string" } }, required: ["report"] },
  outputSchema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
};

describe("native MCP protocol execution", () => {
  it("discovers with private credentials, strips reflected secrets and executes the reviewed action over SSE", async () => {
    const server = createMcpTestServer([{ ...action, description: settings.token }]);

    vi.stubGlobal("fetch", server.fetch);
    const snapshot = await discoverNativeMcpSnapshot(settings);

    expect(JSON.stringify(snapshot)).not.toContain(settings.token);
    expect(
      server.state.requests.every(
        (request) =>
          request.url === settings.endpoint && request.authorization === `Bearer ${settings.token}`,
      ),
    ).toBe(true);
    server.state.tools.push({ name: "new_ungranted_action", inputSchema: { type: "object" } });
    server.state.useSse = true;
    const beforeExecute = vi.fn();
    const result = await executeNativeMcpOperation({
      snapshot,
      token: settings.token,
      operation: "publish",
      params: { report: "Ready" },
      beforeExecute,
    });

    expect(result.structuredContent).toEqual({ ok: true });
    expect(beforeExecute).toHaveBeenCalledOnce();
    expect(server.state.calls).toEqual([{ name: "publish", arguments: { report: "Ready" } }]);
  });

  it("rejects invalid parameters, changed schemas and authority revoked after discovery before dispatching an action", async () => {
    const server = createMcpTestServer([action]);

    vi.stubGlobal("fetch", server.fetch);
    const snapshot = await createIntegrationSnapshot({ ...settings, tools: [action] });
    const request = {
      snapshot,
      token: settings.token,
      operation: "publish",
      params: { report: "Ready" },
      beforeExecute: async () => undefined,
    };

    await expect(
      executeNativeMcpOperation({ ...request, params: { report: 42 } }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    server.state.tools = [{ ...action, inputSchema: { type: "object", required: ["extra"] } }];
    await expect(executeNativeMcpOperation(request)).rejects.toMatchObject({
      code: "DEFINITION_CHANGED",
    });
    server.state.tools = [action];
    await expect(
      executeNativeMcpOperation({
        ...request,
        beforeExecute: async () => {
          throw new Error("Access revoked");
        },
      }),
    ).rejects.toThrow();
    expect(server.state.calls).toEqual([]);
  });

  it("does not repeat an action when its response is lost or violates the output schema", async () => {
    const server = createMcpTestServer([action]);

    vi.stubGlobal("fetch", server.fetch);
    const snapshot = await createIntegrationSnapshot({ ...settings, tools: [action] });
    const request = {
      snapshot,
      token: settings.token,
      operation: "publish",
      params: { report: "Ready" },
      beforeExecute: async () => undefined,
    };

    server.state.failCall = true;
    await expect(executeNativeMcpOperation(request)).rejects.toMatchObject({
      code: "UNKNOWN_OUTCOME",
    });
    expect(server.state.calls).toHaveLength(1);
    server.state.failCall = false;
    server.state.result.structuredContent = { ok: "invalid" };
    await expect(executeNativeMcpOperation(request)).rejects.toMatchObject({
      code: "UNKNOWN_OUTCOME",
    });
    expect(server.state.calls).toHaveLength(2);
  });

  it("blocks credential redirects and enforces response and pagination limits", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 302, headers: { location: "https://other.example.com/mcp" } }),
      );

    vi.stubGlobal("fetch", fetch);
    await expect(discoverNativeMcpSnapshot(settings)).rejects.toMatchObject({
      code: "UNAVAILABLE",
    });
    expect(fetch).toHaveBeenCalledOnce();
    const boundedFetch = createNativeMcpFetch(
      settings.endpoint,
      settings.token,
      AbortSignal.timeout(1000),
    );

    fetch.mockResolvedValue(new Response("x".repeat(2 * 1024 * 1024 + 1)));
    const oversized = await boundedFetch(settings.endpoint, { method: "POST" });

    await expect(oversized.text()).rejects.toThrow("byte limit");
    const server = createMcpTestServer([action]);

    server.state.nextCursor = "same";
    vi.stubGlobal("fetch", server.fetch);
    await expect(discoverNativeMcpSnapshot(settings)).rejects.toMatchObject({
      code: "UNAVAILABLE",
    });
    expect(server.state.calls).toEqual([]);
  });
});
