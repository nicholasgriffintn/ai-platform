import { PermissionChecker } from "@ngriffin_uk/polychat-library-tool-runtime";
import { createChatCompletionsJsonSchema } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { prepareTeammateCompletionRequest } from "../completion-request";
import { buildTeammatePersona } from "../completion-tools";

describe("prepareTeammateCompletionRequest", () => {
  it.each([undefined, 0, 0.4])(
    "preserves automatic or explicit caller sampling (%s)",
    (temperature) => {
      const body = createChatCompletionsJsonSchema.parse({
        model: "mistral-large-latest",
        messages: [{ role: "user", content: "Answer this" }],
        temperature,
      });
      const request = prepareTeammateCompletionRequest({
        teammate: {
          id: "teammate-123",
          kind: "colleague" as const,
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

      expect(request.temperature).toBe(temperature);
    },
  );

  it("uses the Chat tool policy for saved-teammate Chat runs", () => {
    const body = createChatCompletionsJsonSchema.parse({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: "Convene a council" }],
    });

    const request = prepareTeammateCompletionRequest({
      teammate: {
        id: "teammate-123",
        kind: "colleague" as const,
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
      mode: "teammate",
      tool_policy_mode: "chat",
      max_steps: 20,
    });
    expect(request.enforce_mode_tool_policy).toBeUndefined();

    expect(
      new PermissionChecker().checkToolAccess({
        toolName: "run_council",
        mode: Reflect.get(request, "tool_policy_mode"),
        toolPermissions: ["orchestration"],
      }),
    ).toMatchObject({ allowed: true, requiresApproval: false });
  });

  it("falls back to the saved teammate's tools when the caller sends none", () => {
    const body = createChatCompletionsJsonSchema.parse({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: "Search for something" }],
    });

    const request = prepareTeammateCompletionRequest({
      teammate: {
        id: "teammate-123",
        kind: "colleague" as const,
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

  it("does not let the caller widen the saved teammate's tools", () => {
    const body = createChatCompletionsJsonSchema.parse({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: "Search for something" }],
      enabled_tools: ["code_execution"],
    });

    const request = prepareTeammateCompletionRequest({
      teammate: {
        id: "teammate-123",
        kind: "colleague" as const,
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

    expect(request.enabled_tools).toEqual([]);
  });

  it("keeps the caller's streaming choice instead of forcing a buffered turn", () => {
    const streamed = createChatCompletionsJsonSchema.parse({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: "Stream this" }],
      stream: true,
    });

    const request = prepareTeammateCompletionRequest({
      teammate: {
        id: "teammate-123",
        kind: "colleague" as const,
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

  it("runs the teammate in its saved mode without widening the tool policy", () => {
    const body = createChatCompletionsJsonSchema.parse({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: "Plan this out" }],
    });

    const request = prepareTeammateCompletionRequest({
      teammate: {
        id: "teammate-123",
        kind: "colleague" as const,
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

  it("ignores a stored mode that is no longer a known teammate mode", () => {
    const body = createChatCompletionsJsonSchema.parse({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: "Carry on" }],
    });

    const request = prepareTeammateCompletionRequest({
      teammate: {
        id: "teammate-123",
        kind: "colleague" as const,
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

    expect(request.mode).toBe("teammate");
  });

  it("asks for the teammate's saved skills through the persona and the skill loader", () => {
    const teammate = {
      id: "teammate-123",
      kind: "colleague" as const,
      model: null,
      temperature: null,
      max_steps: null,
      enabled_tools: '["web_search"]',
      skill_ids: '["research","fact-checking"]',
      mode: null,
      servers: null,
      system_prompt: "Answer carefully.",
      few_shot_examples: null,
    };
    const body = createChatCompletionsJsonSchema.parse({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: "Check this claim" }],
    });

    const request = prepareTeammateCompletionRequest({
      teammate,
      body,
      modelProvider: "mistral",
      formattedTools: [],
      persona: buildTeammatePersona(teammate),
    });

    expect(request.persona?.instructions).toContain("Answer carefully.");
    expect(request.persona?.instructions).toContain("research, fact-checking");
    expect(request.enabled_tools).toEqual(["web_search", "load_skill"]);
  });

  it("leaves the caller's tool selection alone when the teammate saved no skills", () => {
    const body = createChatCompletionsJsonSchema.parse({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: "Search for something" }],
    });

    const request = prepareTeammateCompletionRequest({
      teammate: {
        id: "teammate-123",
        kind: "colleague" as const,
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
    expect(request.denied_tools).toBeUndefined();
  });

  it("preserves a bot teammate's configured tools", () => {
    const body = createChatCompletionsJsonSchema.parse({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: "Brief me" }],
    });

    const request = prepareTeammateCompletionRequest({
      teammate: {
        id: "teammate-123",
        kind: "bot" as const,
        model: null,
        temperature: null,
        max_steps: null,
        enabled_tools: '["web_search","create_task","store_memory"]',
        skill_ids: "[]",
        mode: null,
      },
      body,
      modelProvider: "mistral",
      formattedTools: [],
      persona: {},
    });

    expect(request.enabled_tools).toEqual(["web_search", "create_task", "store_memory"]);
    expect(request.denied_tools).toBeUndefined();
  });

  it("refuses a denied tool even when the caller asks for it", () => {
    const body = createChatCompletionsJsonSchema.parse({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: "File a task" }],
      enabled_tools: ["create_task"],
      denied_tools: ["create_task"],
    });

    const request = prepareTeammateCompletionRequest({
      teammate: {
        id: "teammate-123",
        kind: "bot" as const,
        model: null,
        temperature: null,
        max_steps: null,
        enabled_tools: null,
        skill_ids: "[]",
        mode: null,
      },
      body,
      modelProvider: "mistral",
      formattedTools: [],
      persona: {},
    });

    expect(request.enabled_tools).toEqual(["create_task"]);
    expect(
      new PermissionChecker().checkToolAccess({
        toolName: "create_task",
        mode: request.mode,
        deniedTools: request.denied_tools,
      }).allowed,
    ).toBe(false);
  });
});
