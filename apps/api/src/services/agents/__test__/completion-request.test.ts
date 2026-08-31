import { PermissionChecker } from "@ngriffin_uk/polychat-library-tool-runtime";
import { createChatCompletionsJsonSchema } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { prepareAgentCompletionRequest } from "../completion-request";

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
      },
      body: streamed,
      modelProvider: "mistral",
      formattedTools: [],
      persona: {},
    });

    expect(request.stream).toBe(true);
  });
});
