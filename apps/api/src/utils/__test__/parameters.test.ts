import { describe, expect, it } from "vitest";

import { getToolsForProvider } from "../parameters";

const modelConfig = { supportsToolCalls: true, supportsToolChoice: false };

function toolNames(tools: unknown[] | undefined): string[] {
  return (tools ?? []).map((tool) => (tool as { function: { name: string } }).function.name);
}

function paramsForMode(mode: string): Parameters<typeof getToolsForProvider>[0] {
  return {
    model: "gpt-5",
    mode,
    enabled_tools: ["get_weather", "delegate_to_team_member"],
  };
}

describe("getToolsForProvider", () => {
  it("offers the agent control tools in an agent execution mode", () => {
    const names = toolNames(
      getToolsForProvider(paramsForMode("build"), modelConfig, "openai").tools,
    );

    expect(names).toEqual(expect.arrayContaining(["update_plan", "finish"]));
  });

  it("withholds the control tools from ordinary chat, where nothing handles them", () => {
    const names = toolNames(
      getToolsForProvider(paramsForMode("normal"), modelConfig, "openai").tools,
    );

    expect(names).not.toContain("update_plan");
    expect(names).not.toContain("finish");
  });

  it("withholds tools blocked by the execution mode", () => {
    const names = toolNames(
      getToolsForProvider(paramsForMode("plan"), modelConfig, "openai").tools,
    );

    expect(names).not.toContain("delegate_to_team_member");
    expect(names).toContain("get_weather");
  });
});
