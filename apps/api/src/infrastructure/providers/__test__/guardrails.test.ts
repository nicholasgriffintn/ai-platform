import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUserSettings } from "~/types";

const mocks = vi.hoisted(() => ({
  getAuxiliaryDecisionModel: vi.fn(),
  resolve: vi.fn(),
}));

vi.mock("../host", () => ({
  providerHost: { models: { getAuxiliaryDecisionModel: mocks.getAuxiliaryDecisionModel } },
}));

vi.mock("../library", () => ({
  providerLibrary: { resolve: mocks.resolve },
}));

import { getGuardrailsProvider } from "../capabilities/guardrails";

const env = { AI: {} } as unknown as IEnv;

function settings(overrides: Partial<IUserSettings>): IUserSettings {
  return { guardrails_enabled: true, ...overrides } as IUserSettings;
}

describe("getGuardrailsProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolve.mockImplementation((_category: string, name: string) => ({ name }));
  });

  it("returns nothing when guardrails are off", async () => {
    await expect(
      getGuardrailsProvider(env, undefined, settings({ guardrails_enabled: false })),
    ).resolves.toBeNull();
    expect(mocks.resolve).not.toHaveBeenCalled();
  });

  it("uses TypeSafe by default when the account has a decision model", async () => {
    mocks.getAuxiliaryDecisionModel.mockResolvedValue({
      model: "jev-latest",
      provider: "typesafe",
    });

    await expect(
      getGuardrailsProvider(env, undefined, settings({ guardrails_provider: undefined })),
    ).resolves.toEqual({ name: "typesafe" });
    expect(mocks.resolve).toHaveBeenCalledWith("guardrails", "typesafe", expect.anything());
  });

  it("falls back to LlamaGuard when TypeSafe is selected but no key resolves", async () => {
    mocks.getAuxiliaryDecisionModel.mockResolvedValue(null);

    await expect(
      getGuardrailsProvider(env, undefined, settings({ guardrails_provider: "typesafe" })),
    ).resolves.toEqual({ name: "llamaguard" });
  });

  it("honours an explicit non-default choice without consulting the decision model", async () => {
    await expect(
      getGuardrailsProvider(env, undefined, settings({ guardrails_provider: "mistral" })),
    ).resolves.toEqual({ name: "mistral" });
    expect(mocks.getAuxiliaryDecisionModel).not.toHaveBeenCalled();
  });
});
