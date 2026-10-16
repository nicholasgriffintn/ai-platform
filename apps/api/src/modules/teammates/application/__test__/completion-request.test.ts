import { PermissionChecker } from "@ngriffin_uk/polychat-library-tools";
import { describe, expect, it } from "vitest";

import { prepareTeammateCompletionRequest } from "../completion-request";
import { buildTeammatePersona } from "../completion-tools";

describe("prepareTeammateCompletionRequest", () => {
  it.each([undefined, 0, 0.4])(
    "preserves automatic or explicit caller sampling (%s)",
    (temperature) => {
      const settings = {
        model: "mistral-large-latest",
        temperature,
      };
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
        settings,
        modelProvider: "mistral",
      });

      expect(request.temperature).toBe(temperature);
    },
  );

  it("defaults a saved teammate without a mode or step budget to teammate mode", () => {
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
      settings: { model: "mistral-large-latest" },
      modelProvider: "mistral",
    });

    expect(request).toMatchObject({ mode: "teammate", max_steps: 20 });
  });

  it("does not let the caller widen the saved teammate's tools", () => {
    const settings = {
      model: "mistral-large-latest",
      enabled_tools: ["code_execution"],
    };

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
      settings,
      modelProvider: "mistral",
    });

    expect(request.enabled_tools).toEqual([]);
  });

  it("ignores a stored mode that is no longer a known teammate mode", () => {
    const settings = {
      model: "mistral-large-latest",
    };

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
      settings,
      modelProvider: "mistral",
    });

    expect(request.mode).toBe("teammate");
  });

  it("runs a hosted-computer teammate in build mode so browser tasks survive the step budget", () => {
    const settings = {
      model: "mistral-large-latest",
    };

    const request = prepareTeammateCompletionRequest({
      teammate: {
        id: "teammate-123",
        kind: "colleague" as const,
        model: null,
        temperature: null,
        max_steps: null,
        enabled_tools: '["use_computer","web_search"]',
        skill_ids: null,
        mode: null,
      },
      settings,
      modelProvider: "mistral",
    });

    expect(request.mode).toBe("build");
  });

  it("keeps an explicit teammate mode over the hosted-computer default", () => {
    const settings = {
      model: "mistral-large-latest",
    };

    const request = prepareTeammateCompletionRequest({
      teammate: {
        id: "teammate-123",
        kind: "colleague" as const,
        model: null,
        temperature: null,
        max_steps: null,
        enabled_tools: '["use_computer"]',
        skill_ids: null,
        mode: "plan",
      },
      settings,
      modelProvider: "mistral",
    });

    expect(request.mode).toBe("plan");
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
    const settings = {
      model: "mistral-large-latest",
    };

    const request = prepareTeammateCompletionRequest({
      teammate,
      settings,
      modelProvider: "mistral",
    });

    const persona = buildTeammatePersona(teammate);

    expect(persona.instructions).toContain("Answer carefully.");
    expect(persona.instructions).toContain("research, fact-checking");
    expect(request.enabled_tools).toEqual(["web_search", "load_skill"]);
  });

  it("refuses a denied tool even when the caller asks for it", () => {
    const settings = {
      model: "mistral-large-latest",
      enabled_tools: ["create_task"],
      denied_tools: ["create_task"],
    };

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
      settings,
      modelProvider: "mistral",
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
