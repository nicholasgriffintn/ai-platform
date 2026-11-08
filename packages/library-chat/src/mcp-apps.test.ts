import { describe, expect, it, vi } from "vitest";

import { buildMcpAppCsp, createMcpAppHostBridge } from "./mcp-apps.js";

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

  it("ignores declared sources that would widen or rewrite the policy", () => {
    const policy = buildMcpAppCsp({
      connectDomains: ["*", "'unsafe-eval'", "https://x.test; script-src *", "https://*.ok.test"],
    });

    expect(policy).toContain("connect-src https://*.ok.test;");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).not.toContain("x.test");
  });

  it("does not dispatch to inherited object methods", async () => {
    const { host, posted } = bridge();

    await host.receive({ jsonrpc: "2.0", id: 9, method: "constructor" });

    expect(posted).toContainEqual(
      expect.objectContaining({ id: 9, error: expect.objectContaining({ code: -32601 }) }),
    );
  });
});
