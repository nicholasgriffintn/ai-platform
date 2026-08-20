import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAITools: vi.fn(),
}));

vi.mock("agents/mcp/client", () => ({
  MCPClientManager: class {
    getAITools = mocks.getAITools;
  },
}));

vi.mock("~/services/agents/mcp-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/services/agents/mcp-client")>()),
  connectMCPServerReady: vi.fn(async () => ({ id: "server-1" })),
}));

import type { IEnv } from "~/types";

import { buildAgentCompletionTools } from "../completion-tools";

const agent = {
  id: "agent-1234567890",
  servers: JSON.stringify([{ url: "https://tools.example.com/sse", name: "Example" }]),
  system_prompt: "",
  few_shot_examples: null,
  team_role: null,
} as any;

const env = { MCP_STORAGE: {} } as unknown as IEnv;

function mockServerTools(count: number) {
  mocks.getAITools.mockResolvedValue(
    Object.fromEntries(
      Array.from({ length: count }, (_, index) => [
        `tool_${index}`,
        { description: `Tool ${index}`, parameters: { type: "object", properties: { id: {} } } },
      ]),
    ),
  );
}

describe("buildAgentCompletionTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps MCP tools out of the inline definitions and offers them as deferrable entries", async () => {
    mockServerTools(3);

    const { definitions, deferrableEntries } = await buildAgentCompletionTools(agent, env);

    expect(definitions.map((definition) => definition.name)).toEqual([
      "request_approval",
      "ask_user",
    ]);
    expect(deferrableEntries).toHaveLength(3);
  });

  it("groups every entry by its server and marks it external", async () => {
    mockServerTools(2);

    const { deferrableEntries } = await buildAgentCompletionTools(agent, env);

    expect(deferrableEntries[0]).toMatchObject({ group: "Example", origin: "external" });
    expect(deferrableEntries.map((entry) => entry.definition.name)).toEqual([
      "mcp_agent-12_tool_0",
      "mcp_agent-12_tool_1",
    ]);
  });

  it("returns no entries for an agent with no servers", async () => {
    const { definitions, deferrableEntries } = await buildAgentCompletionTools(
      { ...agent, servers: null },
      env,
    );

    expect(deferrableEntries).toEqual([]);
    expect(definitions).toHaveLength(2);
  });
});
