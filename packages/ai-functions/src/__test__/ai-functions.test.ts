import type {
  AIProvider,
  ChatCompletionParameters,
  DecisionRequest,
  ProviderRuntime,
} from "@ngriffin_uk/polychat-ai-providers";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";
import z from "zod/v4";

import { createAiFunctions } from "../index.js";
import type { CompletionResult } from "../types.js";

const env = { API_BASE_URL: "https://api.test" };

type GetResponse = (params: ChatCompletionParameters, userId?: number) => Promise<unknown>;

function createRuntime(getResponse: GetResponse, options: { decisionTarget?: boolean } = {}) {
  const modelConfigs: Record<string, ModelConfigItem> = {
    "@cf/cloudflare/clef": {
      matchingModel: "@cf/cloudflare/clef",
      provider: "workers-ai",
      modalities: { input: ["text"], output: ["decision"] },
    },
    "@cf/cloudflare/clef-flash": {
      matchingModel: "@cf/cloudflare/clef-flash",
      provider: "workers-ai",
      modalities: { input: ["text"], output: ["decision"] },
    },
    "@cf/cloudflare/clef-omni": {
      matchingModel: "@cf/cloudflare/clef-omni",
      provider: "workers-ai",
      modalities: { input: ["text", "image", "audio", "video"], output: ["decision"] },
    },
    "gpt-5": {
      matchingModel: "gpt-5",
      provider: "openai",
      modalities: { input: ["text"], output: ["text"] },
    },
    "green-embedding": {
      matchingModel: "green-embedding",
      provider: "greenpt",
      modalities: { input: ["text"], output: ["embedding"] },
    },
  };
  const chat: AIProvider = { name: "openai", supportsStreaming: true, getResponse };
  const decision = {
    name: "typesafe",
    decide: vi.fn(async (request: DecisionRequest) => ({
      provider: "typesafe",
      model: request.model ?? "jev-latest",
      answers: Object.fromEntries(
        Object.entries(request.questions).map(([id, question]) => [
          id,
          question.type === "choice"
            ? {
                type: "choice",
                choice: Object.keys(question.criteria)[0],
                probabilities: Object.fromEntries(
                  Object.keys(question.criteria).map((option, index) => [
                    option,
                    index === 0 ? 1 : 0,
                  ]),
                ),
                confidence: 1,
              }
            : question.type === "score"
              ? {
                  type: "score",
                  score: 1.5,
                  legend: Object.fromEntries(
                    question.criteria.map((level, index) => [String(index), level]),
                  ),
                  probabilities: Object.fromEntries(
                    question.criteria.map((_, index) => [String(index), index === 0 ? 1 : 0]),
                  ),
                  confidence: 0.2,
                }
              : { type: "noul", noul: 0.93 },
        ]),
      ),
      usage: { input_tokens: 42, output_tokens: 3 },
    })),
  };
  const image = { name: "workers-ai", generate: vi.fn(async () => ({ url: "https://img" })) };
  const replicate = {
    name: "replicate",
    generate: vi.fn(async () => {
      throw new Error("replicate down");
    }),
  };
  const resolve = vi.fn((category: string, name: string) => {
    if (category === "chat") {
      return chat;
    }

    if (category === "image") {
      return name === "replicate" ? replicate : image;
    }

    if (category === "decision") {
      return decision;
    }

    throw new Error(`unexpected ${category}`);
  });
  const runtime: ProviderRuntime = {
    host: {
      models: {
        findModelConfig: vi.fn(async (model: string) => modelConfigs[model] ?? null),
        resolveModelProvider: vi.fn(
          async ({ provider, defaultProvider }) => provider ?? defaultProvider,
        ),
        getAuxiliaryDecisionModel: vi.fn(async (_env: unknown, _user: unknown, inputs = []) => {
          if (!options.decisionTarget) {
            return null;
          }

          return inputs.length > 0
            ? { model: "@cf/cloudflare/clef-omni", provider: "workers-ai" }
            : { model: "jev-latest", provider: "typesafe" };
        }),
      } as never,
      storage: { forEnv: () => null, forContext: () => null },
      keyStore: () => undefined,
    },
    providers: { resolve: resolve as never },
  };

  return { runtime, chat, image, replicate, resolve, decision };
}

describe("createAiFunctions", () => {
  it("reports schema mismatches as provider errors", async () => {
    const { runtime } = createRuntime(
      vi.fn<GetResponse>(async () => ({ response: '{"label": "other"}' })),
    );
    const ai = createAiFunctions(runtime);

    await expect(
      ai.classify({ env, model: "gpt-5", input: "hi", labels: ["greeting", "farewell"] }),
    ).rejects.toMatchObject({ type: "PROVIDER_ERROR" });
  });

  it.each(["invalid-json", '{"count": "invalid"}'])(
    "records usage before rejecting invalid structured output: %s",
    async (response) => {
      const usage = { input_tokens: 12, output_tokens: 3 };
      const { runtime } = createRuntime(vi.fn<GetResponse>(async () => ({ response, usage })));
      const account = vi
        .fn<(result: CompletionResult) => Promise<void>>()
        .mockResolvedValue(undefined);

      await expect(
        createAiFunctions(runtime).generateObject(
          {
            env,
            model: "gpt-5",
            prompt: "Return a count",
            schema: z.object({ count: z.number() }),
          },
          account,
        ),
      ).rejects.toMatchObject({ type: "PROVIDER_ERROR" });
      expect(account).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ usage }));
    },
  );
});
