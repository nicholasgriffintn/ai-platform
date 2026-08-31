import { beforeEach, describe, expect, it, vi } from "vitest";

import { LlamaGuardProvider } from "../llamaguard";

const { getAuxiliaryGuardrailsModel, getChatProvider, getResponse } = vi.hoisted(() => ({
  getAuxiliaryGuardrailsModel: vi.fn(),
  getChatProvider: vi.fn(),
  getResponse: vi.fn(),
}));

vi.mock("~/lib/providers/models", () => ({
  getAuxiliaryGuardrailsModel,
}));

vi.mock("../../../chat", () => ({
  getChatProvider,
}));

vi.mock("~/lib/context/serviceContext", () => ({
  createServiceContext: vi.fn(() => ({})),
}));

vi.mock("~/utils/logger", () => ({
  getLogger: () => ({ debug: vi.fn(), error: vi.fn() }),
}));

describe("LlamaGuardProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuxiliaryGuardrailsModel.mockResolvedValue({
      model: "llama-guard",
      provider: "workers-ai",
    });
    getChatProvider.mockReturnValue({ getResponse });
  });

  it("does not mistake an unsafe response containing allowed for a safe verdict", async () => {
    getResponse.mockResolvedValue({ response: "unsafe\nS1: not allowed" });
    const provider = new LlamaGuardProvider({ ai: {} as never, env: {} as never });

    await expect(provider.validateContent("content", "INPUT")).resolves.toEqual(
      expect.objectContaining({ isValid: false }),
    );
  });

  it("accepts only an exact safe first-token verdict", async () => {
    getResponse.mockResolvedValue({ response: "safe" });
    const provider = new LlamaGuardProvider({ ai: {} as never, env: {} as never });

    await expect(provider.validateContent("content", "INPUT")).resolves.toEqual(
      expect.objectContaining({ isValid: true }),
    );
  });
});
