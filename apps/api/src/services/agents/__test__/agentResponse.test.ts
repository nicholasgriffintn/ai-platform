import { describe, expect, it } from "vitest";

import type { Agent } from "~/lib/database/schema";

import { normaliseAgentResponse } from "../agentResponse";

function buildStoredAgent(overrides: Partial<Record<keyof Agent, unknown>> = {}): Agent {
  return {
    id: "agent-1",
    user_id: 7,
    owner_scope_type: "user",
    owner_scope_id: "7",
    derived_from_agent_id: null,
    name: "Researcher",
    description: "",
    avatar_url: null,
    servers: "[]",
    model: null,
    temperature: null,
    max_steps: null,
    system_prompt: null,
    few_shot_examples: null,
    enabled_tools: null,
    skill_ids: null,
    mode: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: null,
    ...overrides,
  } as unknown as Agent;
}

describe("normaliseAgentResponse", () => {
  it("turns the stored JSON string columns into arrays", () => {
    const response = normaliseAgentResponse(
      buildStoredAgent({
        servers: '[{"url":"https://mcp.example.com","type":"sse"}]',
        few_shot_examples: '[{"input":"hello","output":"hi"}]',
        enabled_tools: '["web_search","code_execution"]',
      }),
    );

    expect(response.servers).toEqual([{ url: "https://mcp.example.com", type: "sse" }]);
    expect(response.few_shot_examples).toEqual([{ input: "hello", output: "hi" }]);
    expect(response.enabled_tools).toEqual(["web_search", "code_execution"]);
  });

  it("keeps columns a driver already decoded", () => {
    const response = normaliseAgentResponse(
      buildStoredAgent({
        servers: [{ url: "https://mcp.example.com" }],
        few_shot_examples: [{ input: "hello", output: "hi" }],
        enabled_tools: ["web_search"],
      }),
    );

    expect(response.servers).toEqual([{ url: "https://mcp.example.com", type: "sse" }]);
    expect(response.few_shot_examples).toEqual([{ input: "hello", output: "hi" }]);
    expect(response.enabled_tools).toEqual(["web_search"]);
  });

  it("drops malformed JSON columns instead of throwing", () => {
    const response = normaliseAgentResponse(
      buildStoredAgent({
        servers: "{not json",
        few_shot_examples: "{not json",
        enabled_tools: "{not json",
      }),
    );

    expect(response.servers).toEqual([]);
    expect(response.few_shot_examples).toBeNull();
    expect(response.enabled_tools).toEqual([]);
  });

  it("drops entries that do not match the element shape", () => {
    const response = normaliseAgentResponse(
      buildStoredAgent({
        servers: '[{"url":"not-a-url"},{"url":"https://mcp.example.com"}]',
        few_shot_examples: '[{"input":"hello"},{"input":"hello","output":"hi"}]',
      }),
    );

    expect(response.servers).toEqual([{ url: "https://mcp.example.com", type: "sse" }]);
    expect(response.few_shot_examples).toEqual([{ input: "hello", output: "hi" }]);
  });

  it("coerces the stored temperature text to a number", () => {
    expect(normaliseAgentResponse(buildStoredAgent({ temperature: "0.7" })).temperature).toBe(0.7);
    expect(
      normaliseAgentResponse(buildStoredAgent({ temperature: "warm" })).temperature,
    ).toBeNull();
    expect(normaliseAgentResponse(buildStoredAgent({ temperature: null })).temperature).toBeNull();
  });

  it("round-trips the composed capability columns", () => {
    const response = normaliseAgentResponse(
      buildStoredAgent({
        skill_ids: '["research","fact-checking"]',
        mode: "plan",
      }),
    );

    expect(response.skill_ids).toEqual(["research", "fact-checking"]);
    expect(response.mode).toBe("plan");
  });

  it("drops composed capability entries it cannot trust", () => {
    const response = normaliseAgentResponse(
      buildStoredAgent({
        skill_ids: '["research","Not A Skill Id"]',
        mode: "orchestrate",
      }),
    );

    expect(response.skill_ids).toEqual(["research"]);
    expect(response.mode).toBeNull();
  });
});
