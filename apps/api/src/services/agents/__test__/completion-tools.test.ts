import { LOAD_TOOLS_TOOL_NAME } from "@ngriffin_uk/polychat-schemas";
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

function toolNames(definitions: { name: string }[]): string[] {
  return definitions.map((definition) => definition.name);
}

describe("buildAgentCompletionTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a small MCP catalogue up front", async () => {
    mockServerTools(3);

    const { definitions, deferredTools } = await buildAgentCompletionTools(agent, env);

    expect(deferredTools).toBeUndefined();
    expect(toolNames(definitions)).toContain("mcp_agent-12_tool_0");
    expect(toolNames(definitions)).not.toContain(LOAD_TOOLS_TOOL_NAME);
  });

  it("defers a large MCP catalogue behind the load tool", async () => {
    mockServerTools(40);

    const { definitions, deferredTools } = await buildAgentCompletionTools(agent, env);

    expect(deferredTools?.size).toBe(40);
    expect(toolNames(definitions)).toContain(LOAD_TOOLS_TOOL_NAME);
    expect(toolNames(definitions).some((name) => name.startsWith("mcp_"))).toBe(false);
  });

  it("describes the deferred catalogue on the load tool", async () => {
    mockServerTools(40);

    const { definitions } = await buildAgentCompletionTools(agent, env);
    const loadTool = definitions.find((definition) => definition.name === LOAD_TOOLS_TOOL_NAME);

    expect(loadTool?.description).toContain("40 tools can be loaded");
    expect(loadTool?.description).toContain("Example");
  });

  it("keeps the core agent tools whether or not the catalogue is deferred", async () => {
    mockServerTools(40);

    const { definitions } = await buildAgentCompletionTools(agent, env);

    expect(toolNames(definitions)).toEqual(
      expect.arrayContaining(["request_approval", "ask_user"]),
    );
  });
});
