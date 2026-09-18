import { describe, expect, it, vi } from "vitest";

import { generateWithProviderFallback } from "../fallback";

function providers(failing: string) {
  const calls: string[] = [];
  const getProvider = (name: string) => ({
    generate: vi.fn(async (request: { model?: string }) => {
      calls.push(name);

      if (name === failing) {
        throw new Error(`${name} failed`);
      }

      return { by: name, model: request.model };
    }),
  });

  return { getProvider, calls };
}

describe("generateWithProviderFallback", () => {
  it("falls back to the default provider when no model was pinned", async () => {
    const { getProvider, calls } = providers("replicate");

    await expect(
      generateWithProviderFallback({
        providerName: "replicate",
        defaultProvider: "workers",
        request: {},
        getProvider,
      }),
    ).resolves.toEqual({ by: "workers", model: undefined });
    expect(calls).toEqual(["replicate", "workers"]);
  });

  it("does not fall back when a model was pinned, fallback is disabled, or the default failed", async () => {
    const pinned = providers("replicate");

    await expect(
      generateWithProviderFallback({
        providerName: "replicate",
        defaultProvider: "workers",
        request: { model: "flux" },
        getProvider: pinned.getProvider,
      }),
    ).rejects.toThrow("replicate failed");

    const disabled = providers("replicate");

    await expect(
      generateWithProviderFallback({
        providerName: "replicate",
        defaultProvider: "workers",
        request: {},
        getProvider: disabled.getProvider,
        allowFallback: false,
      }),
    ).rejects.toThrow("replicate failed");

    const defaultFailed = providers("workers");

    await expect(
      generateWithProviderFallback({
        providerName: "workers",
        defaultProvider: "workers",
        request: {},
        getProvider: defaultFailed.getProvider,
      }),
    ).rejects.toThrow("workers failed");
    expect(defaultFailed.calls).toEqual(["workers"]);
  });
});
