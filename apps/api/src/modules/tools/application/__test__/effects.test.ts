import { describe, expect, it } from "vitest";

import { resolveToolCallEffects } from "../effects";

const request = { env: {}, request: { tool_options: { mcp_servers: [] } } } as any;

describe("resolveToolCallEffects", () => {
  it("asks the host for the vendor's hints before trusting the declared class", async () => {
    const effects = {
      effectClass: "write" as const,
      destination: (input: Record<string, unknown>) => `mcp:${String(input.integration)}`,
      hints: async (input: Record<string, unknown>) =>
        input.tool === "search_issues" ? { readOnly: true } : { destructive: true },
    };

    await expect(
      resolveToolCallEffects({
        toolName: "mcp_call_tool",
        effects,
        rawArguments: JSON.stringify({ integration: "Linear", tool: "search_issues" }),
        request,
      }),
    ).resolves.toEqual({ effectClass: "read", destination: "mcp:Linear" });
    await expect(
      resolveToolCallEffects({
        toolName: "mcp_call_tool",
        effects,
        rawArguments: { integration: "Linear", tool: "delete_issue" },
        request,
      }),
    ).resolves.toMatchObject({ effectClass: "destructive" });
  });

  it("keeps the memory tool as a draft and undeclared tools as writes", async () => {
    await expect(
      resolveToolCallEffects({ toolName: "memory", effects: undefined, rawArguments: {}, request }),
    ).resolves.toMatchObject({ effectClass: "draft" });
    await expect(
      resolveToolCallEffects({
        toolName: "mystery",
        effects: undefined,
        rawArguments: {},
        request,
      }),
    ).resolves.toMatchObject({ effectClass: "write" });
  });
});
