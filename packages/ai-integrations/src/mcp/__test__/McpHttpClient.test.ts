import { describe, expect, it, vi } from "vitest";

import { McpHttpClient } from "../McpHttpClient.js";
import { isMcpAuthorizationResponseIssuerValid } from "../oauth/client.js";

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

type McpHandler = (
  payload: { id?: number | string; method: string },
  headers: Headers,
) => Response | undefined;

function recordingFetch(handler: McpHandler) {
  return vi.fn<typeof globalThis.fetch>(async (_input, init) => {
    if (init?.method !== "POST") {
      throw new Error("The client must only POST");
    }

    const payload = JSON.parse(String(init.body));

    return (
      handler(payload, new Headers(init.headers)) ??
      json({ jsonrpc: "2.0", id: payload.id, error: { code: -32601, message: "Unknown method" } })
    );
  });
}

function sessionServer(handler: McpHandler = () => undefined) {
  return recordingFetch((payload, headers) => {
    if (payload.method === "initialize") {
      return json(
        {
          jsonrpc: "2.0",
          id: payload.id,
          result: {
            protocolVersion: "2025-06-18",
            capabilities: { tools: {} },
            serverInfo: { name: "session-server", version: "1.0.0" },
          },
        },
        { headers: { "mcp-session-id": "session-1" } },
      );
    }

    if (payload.method === "notifications/initialized") {
      return new Response(null, { status: 202 });
    }

    return handler(payload, headers);
  });
}

function createClient(fetch: typeof globalThis.fetch, timeoutMs?: number) {
  return new McpHttpClient({
    url: "https://mcp.example.com/mcp",
    headers: { Authorization: "Bearer token" },
    fetch,
    timeoutMs,
  });
}

describe("McpHttpClient", () => {
  it("does not follow redirects", async () => {
    const fetch = sessionServer(
      () => new Response(null, { status: 307, headers: { location: "https://other.example" } }),
    );

    await expect(createClient(fetch).listTools()).rejects.toMatchObject({
      code: "http_error",
      status: 307,
    });
    expect(fetch.mock.calls.every(([, init]) => init?.redirect === "manual")).toBe(true);
  });

  it("refuses private or plain HTTP servers before sending anything", () => {
    expect(() => new McpHttpClient({ url: "http://mcp.example.com" })).toThrow("public HTTPS");
    expect(() => new McpHttpClient({ url: "https://169.254.169.254/mcp" })).toThrow("public HTTPS");
  });
});

describe("isMcpAuthorizationResponseIssuerValid", () => {
  const server = {
    issuer: "https://auth.example.com",
    authorizationEndpoint: "https://auth.example.com/authorize",
    tokenEndpoint: "https://auth.example.com/token",
  };

  it("refuses a response from a different issuer", () => {
    expect(isMcpAuthorizationResponseIssuerValid(server, "https://evil.example.com")).toBe(false);
    expect(isMcpAuthorizationResponseIssuerValid(server, server.issuer)).toBe(true);
  });
});
