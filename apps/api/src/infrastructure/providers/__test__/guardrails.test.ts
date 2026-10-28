import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUserSettings } from "~/types";

const mocks = vi.hoisted(() => ({
  getAuxiliaryGuardrailsModel: vi.fn(),
  resolve: vi.fn(),
}));

vi.mock("../host", () => ({
  providerHost: { models: { getAuxiliaryGuardrailsModel: mocks.getAuxiliaryGuardrailsModel } },
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

  it.each([
    [{ model: "jev-latest", provider: "typesafe" }, "typesafe"],
    [{ model: "mistral-moderation-latest", provider: "mistral" }, "mistral"],
    [{ model: "@cf/meta/llama-guard-3-8b", provider: "workers-ai" }, "llamaguard"],
  ])("runs the chosen Guardrails model %o through %s", async (chosen, service) => {
    mocks.getAuxiliaryGuardrailsModel.mockResolvedValue(chosen);

    await expect(
      getGuardrailsProvider(env, undefined, settings({ guardrails_provider: "model" })),
    ).resolves.toEqual({ name: service });

    if (service !== "llamaguard") {
      expect(mocks.resolve).toHaveBeenCalledWith(
        "guardrails",
        service,
        expect.objectContaining({ config: expect.objectContaining({ model: chosen.model }) }),
      );
    }
  });

  it("uses an external service without consulting the Guardrails model", async () => {
    await expect(
      getGuardrailsProvider(env, undefined, settings({ guardrails_provider: "shieldstral" })),
    ).resolves.toEqual({ name: "shieldstral" });
    expect(mocks.getAuxiliaryGuardrailsModel).not.toHaveBeenCalled();
  });
});
