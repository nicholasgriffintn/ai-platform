import { describe, expect, it } from "vitest";

import type { CoreChatOptions } from "~/types";

import { resolveTurnStepBudget } from "../step-budget";

function options(overrides: Partial<CoreChatOptions> = {}): CoreChatOptions {
  return { completion_id: "completion-1", ...overrides } as CoreChatOptions;
}

describe("resolveTurnStepBudget", () => {
  it("gives an ordinary chat the chat mode budget rather than a single tool round", () => {
    expect(resolveTurnStepBudget(options(), "normal")).toBe(8);
  });

  it("gives recipe chats enough steps to use context tools and save setup", () => {
    const budget = resolveTurnStepBudget(
      options({
        options: { recipe: { id: "bad-weather-alerts", installationId: "1", channel: "web" } },
      }),
      "normal",
    );

    expect(budget).toBe(4);
  });

  it("gives connector chats enough steps to discover, execute, and respond", () => {
    expect(
      resolveTurnStepBudget(options({ enabled_tools: ["use_recipe_connector"] }), "normal"),
    ).toBe(8);
  });

  it("prefers an explicit request over the recipe default", () => {
    const budget = resolveTurnStepBudget(
      options({
        max_steps: 2,
        options: { recipe: { id: "bad-weather-alerts", installationId: "1", channel: "web" } },
      }),
      "normal",
    );

    expect(budget).toBe(2);
  });

  it("gives a signed-in Pro chat the connector budget, which it always has access to", () => {
    const budget = resolveTurnStepBudget(
      options({ context: { user: { id: 42, plan_id: "pro" } } } as Partial<CoreChatOptions>),
      "normal",
    );

    expect(budget).toBe(8);
  });

  it("clamps a request to the ceiling for the mode it runs in", () => {
    expect(resolveTurnStepBudget(options({ max_steps: 200 }), "plan")).toBe(24);
    expect(resolveTurnStepBudget(options({ max_steps: 200 }), "build")).toBe(48);
  });
});
