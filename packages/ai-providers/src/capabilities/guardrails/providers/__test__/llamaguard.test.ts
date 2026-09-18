import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestRuntime } from "../../../../__test__/test-runtime.js";
import { createCatalogueModelResolver } from "../../../../model-resolver.js";
import { LlamaGuardProvider } from "../llamaguard.js";

const getAuxiliaryGuardrailsModel = vi.fn();
const getResponse = vi.fn();
const runtime = createTestRuntime(
  { models: { ...createCatalogueModelResolver(), getAuxiliaryGuardrailsModel } },
  { resolve: () => ({ getResponse }) as never },
);

vi.mock("@ngriffin_uk/polychat-ai-telemetry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-telemetry")>()),
  getLogger: () => ({ debug: vi.fn(), error: vi.fn() }),
}));

describe("LlamaGuardProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuxiliaryGuardrailsModel.mockResolvedValue({
      model: "llama-guard",
      provider: "workers-ai",
    });
  });

  it("does not mistake an unsafe response containing allowed for a safe verdict", async () => {
    getResponse.mockResolvedValue({ response: "unsafe\nS1: not allowed" });
    const provider = new LlamaGuardProvider({ ai: {} as never, env: {} }, runtime);

    await expect(provider.validateContent("content", "INPUT")).resolves.toEqual(
      expect.objectContaining({ isValid: false }),
    );
  });

  it("accepts only an exact safe first-token verdict", async () => {
    getResponse.mockResolvedValue({ response: "safe" });
    const provider = new LlamaGuardProvider({ ai: {} as never, env: {} }, runtime);

    await expect(provider.validateContent("content", "INPUT")).resolves.toEqual(
      expect.objectContaining({ isValid: true }),
    );
  });
});
