import { describe, expect, it, vi } from "vitest";

import { McpHttpClient } from "../McpHttpClient.js";
import { discoverMcpAuthorization } from "../oauth/discovery.js";

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

function sse(body: unknown) {
  return new Response(`event: message\ndata: ${JSON.stringify(body)}\n\n`, {
    headers: { "content-type": "text/event-stream" },
  });
}

describe("McpHttpClient", () => {
  it("initialises once and reuses the server session for every call", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (_input, init) => {
      const payload = JSON.parse(String(init?.body));

      if (payload.method === "initialize") {
        return json(
          { jsonrpc: "2.0", id: payload.id, result: {} },
          {
            headers: { "mcp-session-id": "session-1" },
          },
        );
      }

      if (payload.method === "notifications/initialized") {
        return new Response(null, { status: 202 });
      }

      if (payload.method === "tools/list") {
        return sse({
          jsonrpc: "2.0",
          id: payload.id,
          result: { tools: [{ name: "search_issues", annotations: { readOnlyHint: true } }] },
        });
      }

      return json({
        jsonrpc: "2.0",
        id: payload.id,
        result: { content: [{ type: "text", text: "3 open issues" }] },
      });
    });
    const client = new McpHttpClient({
      url: "https://mcp.example.com/mcp",
      headers: { Authorization: "Bearer token" },
      fetch,
    });

    const tools = await client.listTools();
    const result = await client.callTool("search_issues", { state: "open" });

    expect(tools.map((tool) => tool.name)).toEqual(["search_issues"]);
    expect(result.content[0]?.text).toBe("3 open issues");
    expect(
      fetch.mock.calls.filter(([, init]) => String(init?.body).includes('initialize"')),
    ).toHaveLength(1);
    expect(new Headers(fetch.mock.calls.at(-1)?.[1]?.headers).get("mcp-session-id")).toBe(
      "session-1",
    );
  });

  it("refuses private or plain HTTP servers before sending anything", () => {
    expect(() => new McpHttpClient({ url: "http://mcp.example.com" })).toThrow("public HTTPS");
    expect(() => new McpHttpClient({ url: "https://169.254.169.254/mcp" })).toThrow("public HTTPS");
  });

  it("reports rejected credentials as unauthorised", async () => {
    const client = new McpHttpClient({
      url: "https://mcp.example.com/mcp",
      fetch: vi.fn(async () => new Response("no", { status: 401 })),
    });

    await expect(client.listTools()).rejects.toMatchObject({ code: "unauthorised" });
  });
});

describe("discoverMcpAuthorization", () => {
  it("follows the protected resource metadata to its authorisation server", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const url = String(input);

      if (url === "https://mcp.example.com/.well-known/oauth-protected-resource/mcp") {
        return json({
          resource: "https://mcp.example.com/mcp",
          authorization_servers: ["https://auth.example.com"],
        });
      }

      if (url === "https://auth.example.com/.well-known/oauth-authorization-server") {
        return json({
          issuer: "https://auth.example.com",
          authorization_endpoint: "https://auth.example.com/authorize",
          token_endpoint: "https://auth.example.com/token",
          registration_endpoint: "https://auth.example.com/register",
          code_challenge_methods_supported: ["S256"],
        });
      }

      return new Response("missing", { status: 404 });
    });

    await expect(
      discoverMcpAuthorization({ serverUrl: "https://mcp.example.com/mcp", fetch }),
    ).resolves.toMatchObject({
      resource: "https://mcp.example.com/mcp",
      authorizationServer: {
        tokenEndpoint: "https://auth.example.com/token",
        registrationEndpoint: "https://auth.example.com/register",
      },
    });
  });

  it("refuses servers whose sign-in cannot use PKCE", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) =>
      String(input).includes("oauth-authorization-server")
        ? json({
            issuer: "https://mcp.example.com",
            authorization_endpoint: "https://mcp.example.com/authorize",
            token_endpoint: "https://mcp.example.com/token",
            code_challenge_methods_supported: ["plain"],
          })
        : new Response("missing", { status: 404 }),
    );

    await expect(
      discoverMcpAuthorization({ serverUrl: "https://mcp.example.com/mcp", fetch }),
    ).rejects.toThrow("PKCE");
  });
});
