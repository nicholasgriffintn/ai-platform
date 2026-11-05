import { describe, expect, it, vi } from "vitest";

import { McpHttpClient } from "../McpHttpClient.js";
import {
  buildMcpClientMetadataDocument,
  isMcpAuthorizationResponseIssuerValid,
  resolveMcpOAuthClient,
} from "../oauth/client.js";
import { discoverMcpAuthorization } from "../oauth/discovery.js";

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

function sse(...messages: unknown[]) {
  return new Response(
    messages.map((body) => `event: message\ndata: ${JSON.stringify(body)}\n\n`).join(""),
    { headers: { "content-type": "text/event-stream" } },
  );
}

type McpHandler = (
  payload: { id?: number | string; method: string },
  headers: Headers,
) => Response | undefined;

const COMPLETE_LIST = { resultType: "complete", ttlMs: 0, cacheScope: "private" };

const SEARCH_TOOL = {
  name: "search_issues",
  inputSchema: { type: "object" },
  annotations: { readOnlyHint: true, destructiveHint: false, vendorHint: "kept" },
  _meta: { ui: { resourceUri: "ui://issues/app.html" } },
};

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

function sessionServer(handler: McpHandler = () => undefined, probe?: () => Response) {
  return recordingFetch((payload, headers) => {
    if (payload.method === "server/discover") {
      return probe?.();
    }

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

function statelessServer(handler: McpHandler = () => undefined) {
  return recordingFetch((payload, headers) => {
    if (payload.method === "server/discover") {
      return json({
        jsonrpc: "2.0",
        id: payload.id,
        result: {
          resultType: "complete",
          supportedVersions: ["2026-07-28"],
          capabilities: { tools: {} },
        },
      });
    }

    return handler(payload, headers);
  });
}

const runsTools: McpHandler = (payload) => {
  if (payload.method === "tools/list") {
    return sse({
      jsonrpc: "2.0",
      id: payload.id,
      result: { ...COMPLETE_LIST, tools: [SEARCH_TOOL] },
    });
  }

  return json({
    jsonrpc: "2.0",
    id: payload.id,
    result: { resultType: "complete", content: [{ type: "text", text: "3 open issues" }] },
  });
};

function sentMethods(fetch: ReturnType<typeof recordingFetch>): string[] {
  return fetch.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).method);
}

function sentHeaders(fetch: ReturnType<typeof recordingFetch>, method: string): Headers {
  const calls = fetch.mock.calls.filter(
    ([, init]) => JSON.parse(String(init?.body)).method === method,
  );

  return new Headers(calls.at(-1)?.[1]?.headers);
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
  it("runs tools on a session-based server, reusing one session", async () => {
    const fetch = sessionServer(runsTools);
    const client = createClient(fetch);

    const tools = await client.listTools();
    const result = await client.callTool("search_issues", { state: "open" });

    expect(tools).toEqual([SEARCH_TOOL]);
    expect(result.content[0]?.text).toBe("3 open issues");
    expect(sentMethods(fetch)).toEqual([
      "server/discover",
      "initialize",
      "notifications/initialized",
      "tools/list",
      "tools/call",
    ]);

    const call = sentHeaders(fetch, "tools/call");

    expect(call.get("mcp-session-id")).toBe("session-1");
    expect(call.get("mcp-protocol-version")).toBe("2025-06-18");
    expect(call.get("mcp-method")).toBeNull();
    expect(call.get("authorization")).toBe("Bearer token");
  });

  it("runs tools on a stateless server without a handshake or session", async () => {
    const fetch = statelessServer(runsTools);
    const client = createClient(fetch);

    const tools = await client.listTools();
    const result = await client.callTool("search_issues", { state: "open" });

    expect(tools).toEqual([SEARCH_TOOL]);
    expect(result.content[0]?.text).toBe("3 open issues");
    expect(sentMethods(fetch)).toEqual(["server/discover", "tools/list", "tools/call"]);

    const call = sentHeaders(fetch, "tools/call");
    const body = JSON.parse(String(fetch.mock.calls.at(-1)?.[1]?.body));

    expect(call.get("mcp-session-id")).toBeNull();
    expect(call.get("mcp-protocol-version")).toBe("2026-07-28");
    expect(call.get("mcp-method")).toBe("tools/call");
    expect(call.get("mcp-name")).toBe("search_issues");
    expect(body.params._meta).toMatchObject({
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": { name: "polychat" },
    });
  });

  it.each([
    ["a 400 with no body", () => new Response(null, { status: 400 })],
    ["a 404", () => new Response("missing", { status: 404 })],
    ["a 500", () => new Response("crashed", { status: 500 })],
    ["an empty 200", () => new Response("", { status: 200 })],
  ])("falls back to a session when the probe gets %s", async (_label, probe) => {
    const fetch = sessionServer(runsTools, probe);

    await expect(createClient(fetch).listTools()).resolves.toHaveLength(1);
    expect(sentMethods(fetch)).toContain("initialize");
  });

  it("does not fall back when the server refuses the credentials", async () => {
    const fetch = recordingFetch(() => new Response("no", { status: 401 }));

    await expect(createClient(fetch).listTools()).rejects.toMatchObject({ code: "unauthorised" });
    expect(sentMethods(fetch)).toEqual(["server/discover"]);
  });

  it("keeps tools and results from session servers that the SDK schemas would refuse", async () => {
    const fetch = sessionServer((payload) => {
      if (payload.method === "tools/list") {
        return json({
          jsonrpc: "2.0",
          id: payload.id,
          result: { tools: [{ name: "no_schema" }, { title: "unnamed" }] },
        });
      }

      return json({
        jsonrpc: "2.0",
        id: payload.id,
        result: { content: [{ type: "chart", series: [1] }], structuredContent: [1, 2] },
      });
    });
    const client = createClient(fetch);

    await expect(client.listTools()).resolves.toEqual([{ name: "no_schema" }]);
    await expect(client.callTool("no_schema", {})).resolves.toEqual({
      content: [{ type: "chart", series: [1] }],
      structuredContent: [1, 2],
    });
  });

  it("reports a tool that needs a further step without repeating the call", async () => {
    const fetch = statelessServer((payload) =>
      json({
        jsonrpc: "2.0",
        id: payload.id,
        result: { resultType: "input_required", requestState: "opaque" },
      }),
    );

    await expect(createClient(fetch).callTool("deploy", {})).rejects.toMatchObject({
      code: "invalid_response",
      operation: "deploy",
      message: expect.stringContaining("cannot complete"),
    });
    expect(sentMethods(fetch).filter((method) => method === "tools/call")).toHaveLength(1);
  });

  it("surfaces JSON-RPC errors from either kind of server", async () => {
    const refuse: McpHandler = (payload) =>
      json({ jsonrpc: "2.0", id: payload.id, error: { code: -32602, message: "Unknown tool" } });

    for (const fetch of [sessionServer(refuse), statelessServer(refuse)]) {
      await expect(createClient(fetch).callTool("missing", {})).rejects.toMatchObject({
        code: "rpc_error",
        operation: "missing",
        message: "Unknown tool",
        requestSent: true,
      });
    }
  });

  it("fails a stream that ends without a reply rather than waiting forever", async () => {
    const fetch = sessionServer((payload) =>
      payload.method === "tools/call"
        ? sse({ jsonrpc: "2.0", method: "notifications/progress", params: {} })
        : undefined,
    );

    await expect(createClient(fetch).callTool("slow", {})).rejects.toMatchObject({
      code: "invalid_response",
      requestSent: true,
    });
  });

  it("refuses a reply larger than one call can carry", async () => {
    const fetch = sessionServer(() => new Response("x".repeat(2_000_001)));

    await expect(createClient(fetch).callTool("big", {})).rejects.toThrow("more data");
  });

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

  it("says nothing reached the server when the network fails", async () => {
    const client = createClient(
      vi.fn(async () => {
        throw new TypeError("connection refused");
      }),
    );

    await expect(client.callTool("search_issues", {})).rejects.toMatchObject({
      code: "network_error",
      requestSent: false,
    });
  });

  it("times out everything except a running tool call", async () => {
    const server = statelessServer(runsTools);
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const method = JSON.parse(String(init?.body)).method;

      if (method === "tools/list") {
        return new Promise<never>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        });
      }

      if (method === "tools/call") {
        await new Promise((resolve) => setTimeout(resolve, 40));
      }

      return server(input, init);
    });
    const client = createClient(fetch, 10);

    await expect(client.listTools()).rejects.toMatchObject({ code: "timeout", requestSent: true });
    await expect(client.callTool("search_issues", {})).resolves.toMatchObject({
      content: [{ text: "3 open issues" }],
    });
  });

  it("reconnects on the next call after a failed connection", async () => {
    const server = statelessServer(runsTools);
    const fetch = vi.fn<typeof globalThis.fetch>(server);

    fetch.mockRejectedValueOnce(new TypeError("connection reset"));

    const client = createClient(fetch);

    await expect(client.listTools()).rejects.toMatchObject({ code: "network_error" });
    await expect(client.listTools()).resolves.toHaveLength(1);
  });

  it("refuses private or plain HTTP servers before sending anything", () => {
    expect(() => new McpHttpClient({ url: "http://mcp.example.com" })).toThrow("public HTTPS");
    expect(() => new McpHttpClient({ url: "https://169.254.169.254/mcp" })).toThrow("public HTTPS");
  });

  describe("parameter headers on stateless servers", () => {
    const annotated = (name: string, header: string) => ({
      name,
      inputSchema: {
        type: "object",
        properties: { region: { type: "string", "x-mcp-header": header } },
      },
    });
    const listing =
      (tools: unknown[]): McpHandler =>
      (payload) =>
        json({
          jsonrpc: "2.0",
          id: payload.id,
          result:
            payload.method === "tools/list"
              ? { ...COMPLETE_LIST, tools }
              : { resultType: "complete", content: [] },
        });

    it("mirrors annotated arguments into headers", async () => {
      const fetch = statelessServer(listing([annotated("open_ticket", "Region")]));
      const client = createClient(fetch);
      const regionHeader = () => sentHeaders(fetch, "tools/call").get("mcp-param-region");

      await client.listTools();
      await client.callTool("open_ticket", { region: "eu-west" });
      expect(regionHeader()).toBe("eu-west");

      await client.callTool("open_ticket", { region: "Zürich" });
      expect(regionHeader()).toBe("=?base64?WsO8cmljaA==?=");

      await client.callTool("open_ticket", { region: "=?base64?eA==?=" });
      expect(regionHeader()).toBe("=?base64?PT9iYXNlNjQ/ZUE9PT89?=");

      await client.callTool("open_ticket", { region: null });
      expect(regionHeader()).toBeNull();
    });

    it("drops tools with invalid annotations on stateless servers only", async () => {
      const plain = { name: "plain", inputSchema: { type: "object" } };
      const tools = [
        annotated("spaced", "Not Valid"),
        {
          name: "nested_in_array",
          inputSchema: {
            type: "object",
            properties: {
              items: { type: "array", items: { type: "string", "x-mcp-header": "Item" } },
            },
          },
        },
        {
          name: "duplicate",
          inputSchema: {
            type: "object",
            properties: {
              a: { type: "string", "x-mcp-header": "Same" },
              b: { type: "string", "x-mcp-header": "same" },
            },
          },
        },
        {
          name: "floating",
          inputSchema: {
            type: "object",
            properties: { a: { type: "number", "x-mcp-header": "Amount" } },
          },
        },
        plain,
      ];

      await expect(createClient(statelessServer(listing(tools))).listTools()).resolves.toEqual([
        plain,
      ]);
      await expect(createClient(sessionServer(listing(tools))).listTools()).resolves.toEqual(tools);
    });

    it("learns the headers and retries once when the server reports a mismatch", async () => {
      const list = listing([annotated("open_ticket", "Region")]);
      const fetch = statelessServer((payload, headers) => {
        if (payload.method === "tools/list" || headers.get("mcp-param-region")) {
          return list(payload, headers);
        }

        return json(
          { jsonrpc: "2.0", id: payload.id, error: { code: -32020, message: "Header mismatch" } },
          { status: 400 },
        );
      });

      await expect(
        createClient(fetch).callTool("open_ticket", { region: "eu-west" }),
      ).resolves.toEqual({ content: [] });
      expect(sentMethods(fetch)).toEqual([
        "server/discover",
        "tools/call",
        "tools/list",
        "tools/call",
      ]);
    });
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

describe("resolveMcpOAuthClient", () => {
  const server = {
    issuer: "https://auth.example.com",
    authorizationEndpoint: "https://auth.example.com/authorize",
    tokenEndpoint: "https://auth.example.com/token",
    registrationEndpoint: "https://auth.example.com/register",
  };
  const request = {
    clientMetadataUrl: "https://api.example.com/tools/mcp_connections/client-metadata.json",
    redirectUri: "https://api.example.com/tools/mcp_connections/callback",
    clientName: "Polychat",
  };

  it("uses the metadata document URL as the client id when the server accepts it", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();

    await expect(
      resolveMcpOAuthClient({
        ...request,
        server: { ...server, clientIdMetadataDocumentSupported: true },
        fetch,
      }),
    ).resolves.toEqual({ clientId: request.clientMetadataUrl });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["the server does not accept documents", server, request.clientMetadataUrl],
    [
      "the document is not on HTTPS",
      { ...server, clientIdMetadataDocumentSupported: true },
      "http://localhost:8787/tools/mcp_connections/client-metadata.json",
    ],
  ])("registers dynamically when %s", async (_label, target, clientMetadataUrl) => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json({ client_id: "registered" }));

    await expect(
      resolveMcpOAuthClient({ ...request, server: target, clientMetadataUrl, fetch }),
    ).resolves.toEqual({ clientId: "registered" });
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toMatchObject({
      application_type: "web",
      redirect_uris: [request.redirectUri],
    });
  });

  it("publishes a document whose client id is its own URL", () => {
    expect(
      buildMcpClientMetadataDocument({
        clientId: request.clientMetadataUrl,
        clientName: request.clientName,
        redirectUri: request.redirectUri,
      }),
    ).toMatchObject({
      client_id: request.clientMetadataUrl,
      client_name: "Polychat",
      redirect_uris: [request.redirectUri],
      token_endpoint_auth_method: "none",
    });
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

  it("requires the issuer only when the server promised to send it", () => {
    expect(isMcpAuthorizationResponseIssuerValid(server, undefined)).toBe(true);
    expect(
      isMcpAuthorizationResponseIssuerValid(
        { ...server, issuerResponseParameterSupported: true },
        undefined,
      ),
    ).toBe(false);
  });
});
