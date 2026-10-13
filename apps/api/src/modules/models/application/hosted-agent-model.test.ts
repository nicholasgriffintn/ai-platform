import { getModels, resolveHostedAgentModel } from "@ngriffin_uk/polychat-ai-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  catalogOverride: null as Record<string, never> | null,
}));

vi.mock("@ngriffin_uk/polychat-ai-models", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ngriffin_uk/polychat-ai-models")>();

  return {
    ...actual,
    getModels: (...args: Parameters<typeof actual.getModels>) =>
      modelMocks.catalogOverride ?? actual.getModels(...args),
  };
});

vi.mock("~/modules/models/application/resolve", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/modules/models/application/resolve")>();

  return {
    ...actual,
    filterModelsForUserAccess: async (
      models: Parameters<typeof actual.filterModelsForUserAccess>[0],
    ) => models,
  };
});

import { resolveHostedAgentRunModel } from "./hosted-agent-model";

function context() {
  return {
    env: {},
    repositories: {
      workspaces: {
        getProject: vi.fn(async () => null),
      },
    },
  } as any;
}

describe("resolveHostedAgentRunModel", () => {
  beforeEach(() => {
    modelMocks.catalogOverride = null;
  });

  it("resolves the tier lineup for the requested role", async () => {
    const user = { id: 1, plan_id: "pro" } as any;
    const resolved = await resolveHostedAgentRunModel({
      context: context(),
      user,
      role: "agent",
      capability: "Hermes",
    });
    const expected = resolveHostedAgentModel(getModels(), user, "medium", "agent");

    expect(resolved.model).toBe(expected?.id);
    expect(typeof resolved.model).toBe("string");
  });

  it("fails when no hosted model is available", async () => {
    modelMocks.catalogOverride = {};

    await expect(
      resolveHostedAgentRunModel({
        context: context(),
        user: { id: 1, plan_id: "pro" } as any,
        role: "agent",
        capability: "Hermes",
      }),
    ).rejects.toThrow(/No active hermes model is available/);
  });
});
