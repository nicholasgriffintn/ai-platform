import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

const mocks = vi.hoisted(() => ({
  getResponse: vi.fn(),
}));

vi.mock("~/lib/context/serviceContext", () => ({
  createServiceContext: vi.fn(() => ({})),
}));
vi.mock("~/lib/providers/capabilities/chat", () => ({
  getChatProvider: vi.fn(() => ({ getResponse: mocks.getResponse })),
}));
vi.mock("~/lib/providers/models", () => ({
  getAuxiliaryModel: vi.fn(async () => ({
    model: "openai/gpt-oss-20b",
    provider: "groq",
  })),
  getAvailableStrengths: vi.fn(() => ["analysis", "coding"]),
}));
vi.mock("~/services/functions/definitions", () => ({
  listFunctionToolDefinitions: vi.fn(() => []),
}));

import { PromptAnalyzer } from "./promptAnalyser";

describe("PromptAnalyzer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getResponse.mockImplementation(async (params) => {
      if (params.response_format?.type === "json_object") {
        throw new Error("json_validate_failed");
      }

      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                expectedComplexity: 2,
                requiredStrengths: ["coding"],
                criticalStrengths: [],
                estimatedInputTokens: 12,
                estimatedOutputTokens: 80,
                needsFunctions: false,
                benefitsFromMultipleModels: false,
                modelComparisonReason: "",
              }),
            },
          },
        ],
      };
    });
  });

  it("uses strict structured output for the Groq auxiliary model", async () => {
    await expect(
      PromptAnalyzer.analyzePrompt(
        Object.create(null) as IEnv,
        "Fix this TypeScript function",
        [],
        undefined,
        Object.create(null) as IUser,
      ),
    ).resolves.toMatchObject({
      expectedComplexity: 2,
      requiredStrengths: ["coding"],
    });

    expect(mocks.getResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: {
          type: "json_schema",
          json_schema: expect.objectContaining({
            name: "prompt_requirements",
            strict: true,
          }),
        },
      }),
    );
  });
});
