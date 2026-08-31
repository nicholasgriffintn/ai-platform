import { PermissionChecker } from "@ngriffin_uk/polychat-library-tool-runtime";
import { createChatCompletionsJsonSchema } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { prepareAgentCompletionRequest } from "../completion-request";
import { buildAgentPersona } from "../completion-tools";

describe("prepareAgentCompletionRequest", () => {
  it("uses the Chat tool policy for saved-agent Chat runs", () => {
    const body = createChatCompletionsJsonSchema.parse({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: "Delegate this to the team" }],
    });

    const request = prepareAgentCompletionRequest({
      agent: {
        id: "agent-123",
        model: null,
        temperature: null,
        max_steps: null,
        enabled_tools: null,
        skill_ids: null,
        mode: null,
      },
      body,
      modelProvider: "mistral",
      formattedTools: [],
      persona: {},
    });

    expect(request).toMatchObject({
      mode: "agent",
      tool_policy_mode: "chat",
      max_steps: 20,
    });
    expect(request.enforce_mode_tool_policy).toBeUndefined();

    expect(
      new PermissionChecker().checkToolAccess({
        toolName: "delegate_to_team_member",
        mode: Reflect.get(request, "tool_policy_mode"),
        toolPermissions: ["delegate"],
      }),
    ).toMatchObject({ allowed: true, requiresApproval: false });
  });

  it("falls back to the saved agent's tools when the caller sends none", () => {
    const body = createChatCompletionsJsonSchema.parse({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: "Search for something" }],
    });

    const request = prepareAgentCompletionRequest({
      agent: {
        id: "agent-123",
        model: null,
        temperature: null,
        max_steps: null,
        enabled_tools: '["web_search"]',
        skill_ids: null,
        mode: null,
      },
      body,
      modelProvider: "mistral",
      formattedTools: [],
      persona: {},
    });

    expect(request.enabled_tools).toEqual(["web_search"]);
  });

  it("lets the caller's tool selection override the saved agent's", () => {
    const body = createChatCompletionsJsonSchema.parse({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: "Search for something" }],
      enabled_tools: ["code_execution"],
    });

    const request = prepareAgentCompletionRequest({
      agent: {
        id: "agent-123",
        model: null,
        temperature: null,
        max_steps: null,
        enabled_tools: '["web_search"]',
        skill_ids: null,
        mode: null,
      },
      body,
      modelProvider: "mistral",
      formattedTools: [],
      persona: {},
    });

    expect(request.enabled_tools).toEqual(["code_execution"]);
  });

  it("keeps the caller's streaming choice instead of forcing a buffered turn", () => {
    const streamed = createChatCompletionsJsonSchema.parse({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: "Stream this" }],
      stream: true,
    });

    const request = prepareAgentCompletionRequest({
      agent: {
        id: "agent-123",
        model: null,
        temperature: null,
        max_steps: null,
        enabled_tools: null,
        skill_ids: null,
        mode: null,
      },
      body: streamed,
      modelProvider: "mistral",
      formattedTools: [],
      persona: {},
    });

    expect(request.stream).toBe(true);
  });

  it("runs the agent in its saved mode without widening the tool policy", () => {
    const body = createChatCompletionsJsonSchema.parse({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: "Plan this out" }],
    });

    const request = prepareAgentCompletionRequest({
      agent: {
        id: "agent-123",
        model: null,
        temperature: null,
        max_steps: null,
        enabled_tools: null,
        skill_ids: null,
        mode: "plan",
      },
      body,
      modelProvider: "mistral",
      formattedTools: [],
      persona: {},
    });

    expect(request).toMatchObject({ mode: "plan", tool_policy_mode: "chat" });
  });

  it("ignores a stored mode that is no longer a known agent mode", () => {
    const body = createChatCompletionsJsonSchema.parse({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: "Carry on" }],
    });

    const request = prepareAgentCompletionRequest({
      agent: {
        id: "agent-123",
        model: null,
        temperature: null,
        max_steps: null,
        enabled_tools: null,
        skill_ids: null,
        mode: "orchestrate" as never,
      },
      body,
      modelProvider: "mistral",
      formattedTools: [],
      persona: {},
    });

    expect(request.mode).toBe("agent");
  });

  it("asks for the agent's saved skills through the persona and the skill loader", () => {
    const agent = {
      id: "agent-123",
      model: null,
      temperature: null,
      max_steps: null,
      enabled_tools: '["web_search"]',
      skill_ids: '["research","fact-checking"]',
      mode: null,
      servers: null,
      system_prompt: "Answer carefully.",
      few_shot_examples: null,
      team_role: null,
    };
    const body = createChatCompletionsJsonSchema.parse({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: "Check this claim" }],
    });

    const request = prepareAgentCompletionRequest({
      agent,
      body,
      modelProvider: "mistral",
      formattedTools: [],
      persona: buildAgentPersona(agent),
    });

    expect(request.persona?.instructions).toContain("Answer carefully.");
    expect(request.persona?.instructions).toContain("research, fact-checking");
    expect(request.enabled_tools).toEqual(["web_search", "load_skill"]);
  });

  it("leaves the caller's tool selection alone when the agent saved no skills", () => {
    const body = createChatCompletionsJsonSchema.parse({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: "Search for something" }],
    });

    const request = prepareAgentCompletionRequest({
      agent: {
        id: "agent-123",
        model: null,
        temperature: null,
        max_steps: null,
        enabled_tools: '["web_search"]',
        skill_ids: "[]",
        mode: null,
      },
      body,
      modelProvider: "mistral",
      formattedTools: [],
      persona: {},
    });

    expect(request.enabled_tools).toEqual(["web_search"]);
  });
});
