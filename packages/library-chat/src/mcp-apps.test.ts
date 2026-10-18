import { describe, expect, it, vi } from "vitest";

import { buildMcpAppAllow, buildMcpAppCsp, createMcpAppHostBridge } from "./mcp-apps.js";

function bridge() {
  const posted: Record<string, unknown>[] = [];
  const callbacks = {
    post: (message: Record<string, unknown>) => {
      posted.push(message);
    },
    callTool: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] }),
    openLink: vi.fn(),
    sendMessage: vi.fn(),
    resize: vi.fn(),
  };
  const host = createMcpAppHostBridge({
    toolName: "list_issues",
    toolArguments: { team: "ENG" },
    toolResult: { content: [{ type: "text", text: "3 issues" }], structuredContent: { n: 3 } },
    theme: "light",
    callbacks,
  });

  return { host, posted, callbacks };
}

describe("MCP app host bridge", () => {
  it("answers ui/initialize and sends input then result after initialized", async () => {
    const { host, posted } = bridge();

    await host.receive({ jsonrpc: "2.0", id: 1, method: "ui/initialize", params: {} });
    expect(posted[0]).toMatchObject({ id: 1, result: { hostInfo: { name: "polychat" } } });
    expect(host.initialised()).toBe(false);

    await host.receive({ jsonrpc: "2.0", method: "ui/notifications/initialized" });
    expect(host.initialised()).toBe(true);
    expect(posted.slice(1)).toEqual([
      {
        jsonrpc: "2.0",
        method: "ui/notifications/tool-input",
        params: { arguments: { team: "ENG" } },
      },
      {
        jsonrpc: "2.0",
        method: "ui/notifications/tool-result",
        params: { content: [{ type: "text", text: "3 issues" }], structuredContent: { n: 3 } },
      },
    ]);
  });

  it("proxies tool calls and refuses links that are not web addresses", async () => {
    const { host, posted, callbacks } = bridge();

    await host.receive({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "search", arguments: { q: "x" } },
    });
    expect(callbacks.callTool).toHaveBeenCalledWith("search", { q: "x" });
    expect(posted.at(-1)).toMatchObject({ id: 7, result: { content: [{ text: "ok" }] } });

    await host.receive({
      jsonrpc: "2.0",
      id: 8,
      method: "ui/open-link",
      params: { url: "javascript:alert(1)" },
    });
    expect(callbacks.openLink).not.toHaveBeenCalled();
    expect(posted.at(-1)).toMatchObject({ id: 8, error: { code: -32602 } });

    await host.receive({ jsonrpc: "2.0", id: 9, method: "sampling/createMessage", params: {} });
    expect(posted.at(-1)).toMatchObject({ id: 9, error: { code: -32601 } });
  });

  it("builds a closed policy by default and widens only what the app declares", () => {
    expect(buildMcpAppCsp(undefined)).toContain("connect-src 'none'");
    expect(buildMcpAppCsp({ connectDomains: ["https://api.example.com"] })).toContain(
      "connect-src https://api.example.com",
    );
    expect(buildMcpAppCsp({ resourceDomains: ["https://cdn.example.com"] })).toContain(
      "script-src 'self' 'unsafe-inline' https://cdn.example.com",
    );
    expect(buildMcpAppAllow({ clipboardWrite: {}, camera: {} })).toBe("camera; clipboard-write");
    expect(buildMcpAppAllow(undefined)).toBe("");
  });
});
