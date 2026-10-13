import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listMcpConnections: vi.fn(),
  resolveMcpGatewayAccess: vi.fn(),
  listTools: vi.fn(),
  callTool: vi.fn(),
}));

vi.mock("../mcp-connections", () => ({
  listMcpConnections: mocks.listMcpConnections,
  resolveMcpGatewayAccess: mocks.resolveMcpGatewayAccess,
}));

vi.mock("@ngriffin_uk/polychat-ai-integrations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-integrations")>()),
  McpHttpClient: class {
    listTools = mocks.listTools;
    callTool = mocks.callTool;
  },
}));

import { mcp_call_tool } from "~/modules/functions/application/mcp_gateway";

import { mergeNativeMcpToolNames, shouldUseNativeMcpGateway } from "../mcp-gateway-servers";

const servers = [
  { label: "linear", url: "https://mcp.linear.app/mcp", credentialConnectionId: "connection-1" },
];
const signedInUser = { user: { id: 7 } };
const context = { ...signedInUser, requestCache: new Map() } as never;

describe("native MCP gateway selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("swaps the hosted MCP tool for the gateway when the model has no hosted MCP", async () => {
    const useNativeGateway = await shouldUseNativeMcpGateway({
      context,
      enabledTools: ["mcp", "web_search"],
      servers,
      supportsHostedMcp: false,
    });

    expect(useNativeGateway).toBe(true);
    expect(
      mergeNativeMcpToolNames({ enabledTools: ["mcp", "web_search"], useNativeGateway }),
    ).toEqual(["web_search", "mcp_list_tools", "mcp_call_tool"]);
  });

  it("keeps OpenAI's hosted tool unless a credential is only for Polychat", async () => {
    mocks.listMcpConnections.mockResolvedValueOnce({
      connections: [{ id: "connection-1", credentialRecipient: "openai" }],
    });
    await expect(
      shouldUseNativeMcpGateway({
        context,
        enabledTools: ["mcp"],
        servers,
        supportsHostedMcp: true,
      }),
    ).resolves.toBe(false);

    mocks.listMcpConnections.mockResolvedValueOnce({
      connections: [{ id: "connection-1", credentialRecipient: "polychat" }],
    });
    await expect(
      shouldUseNativeMcpGateway({
        context,
        enabledTools: ["mcp"],
        servers,
        supportsHostedMcp: true,
      }),
    ).resolves.toBe(true);
  });
});

describe("mcp_call_tool", () => {
  it("refuses tools the connection does not allow without contacting the server", async () => {
    mocks.resolveMcpGatewayAccess.mockResolvedValue({
      headers: { Authorization: "Bearer token" },
      allowedTools: ["search_issues"],
    });

    const result = await mcp_call_tool.execute(
      { integration: "linear", tool: "delete_issue", arguments: { id: "1" } },
      {
        completionId: "conversation-1",
        env: {},
        request: {
          env: {},
          context: { ...signedInUser, requestCache: new Map() },
          request: {
            tool_options: {
              mcp_servers: [
                {
                  server_label: "linear",
                  server_url: "https://mcp.linear.app/mcp",
                  credential_connection_id: "connection-1",
                },
              ],
            },
          },
        },
      } as never,
    );

    expect(result.status).toBe("error");
    expect(String(result.content)).toContain("Nothing was sent");
    expect(mocks.callTool).not.toHaveBeenCalled();
  });
});
