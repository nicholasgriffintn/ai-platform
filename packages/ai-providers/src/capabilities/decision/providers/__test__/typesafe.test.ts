import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProviderRuntime } from "../../../../runtime.js";
import { TypeSafeDecisionProvider } from "../typesafe.js";

const { fetchProviderJson } = vi.hoisted(() => ({
  fetchProviderJson: vi.fn(),
}));

vi.mock("../../../../fetch.js", () => ({
  fetchProviderJson,
}));

function createRuntime(userKey?: string): ProviderRuntime {
  return {
    host: {
      models: {} as never,
      storage: { forEnv: () => null, forContext: () => null },
      keyStore: () =>
        userKey
          ? {
              hasProviderApiKey: async () => true,
              getProviderApiKey: async () => userKey,
            }
          : undefined,
    },
    providers: { resolve: vi.fn() as never },
  };
}

const answers = {
  urgent: { type: "noul", noul: 0.97 },
  team: {
    type: "choice",
    choice: "billing",
    probabilities: { billing: 0.8, technical: 0.2 },
    confidence: 0.6,
  },
};

describe("TypeSafeDecisionProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts the state and questions with the platform key and normalises the answer", async () => {
    fetchProviderJson.mockResolvedValue({
      model: "jev-1.13.0",
      answers,
      usage: { input_tokens: 120, output_tokens: 9 },
    });
    const provider = new TypeSafeDecisionProvider(
      { TYPESAFE_API_KEY: "platform-key" },
      undefined,
      createRuntime(),
    );

    const result = await provider.decide({
      state: { message: "Charged twice, fix it now" },
      questions: {
        urgent: { type: "noul", instructions: "Is `message` urgent?" },
        team: {
          type: "choice",
          instructions: "Which team?",
          criteria: { billing: null, technical: null },
        },
      },
    });

    expect(result).toEqual({
      provider: "typesafe",
      model: "jev-1.13.0",
      answers,
      usage: { input_tokens: 120, output_tokens: 9 },
    });
    expect(fetchProviderJson).toHaveBeenCalledWith(
      "typesafe",
      "https://api.typesafe.ai/v1/systemone",
      expect.objectContaining({
        apiKey: "platform-key",
        body: expect.objectContaining({
          model: "jev-latest",
          state: { message: "Charged twice, fix it now" },
        }),
      }),
    );
  });

  it("prefers the user's stored key and an explicit base URL", async () => {
    fetchProviderJson.mockResolvedValue({ answers, usage: {} });
    const provider = new TypeSafeDecisionProvider(
      { TYPESAFE_API_KEY: "platform-key", TYPESAFE_BASE_URL: "https://proxy.example/" },
      { id: 4 },
      createRuntime("user-key"),
    );

    const result = await provider.decide({
      state: "hello",
      model: "jev-preview",
      questions: { urgent: { type: "noul", instructions: "?" } },
    });

    expect(result.model).toBe("jev-preview");
    expect(result.usage).toEqual({ input_tokens: 0, output_tokens: 0 });
    expect(fetchProviderJson).toHaveBeenCalledWith(
      "typesafe",
      "https://proxy.example/v1/systemone",
      expect.objectContaining({ apiKey: "user-key" }),
    );
  });

  it("rejects payloads whose answers do not match the contract", async () => {
    fetchProviderJson.mockResolvedValue({ answers: { urgent: { type: "noul", noul: 4 } } });
    const provider = new TypeSafeDecisionProvider(
      { TYPESAFE_API_KEY: "platform-key" },
      undefined,
      createRuntime(),
    );

    await expect(
      provider.decide({ state: "x", questions: { urgent: { type: "noul", instructions: "?" } } }),
    ).rejects.toMatchObject({ type: "PROVIDER_ERROR" });
  });

  it("fails clearly when no key is configured", async () => {
    const provider = new TypeSafeDecisionProvider({}, undefined, createRuntime());

    await expect(
      provider.decide({ state: "x", questions: { urgent: { type: "noul", instructions: "?" } } }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    expect(fetchProviderJson).not.toHaveBeenCalled();
  });
});
