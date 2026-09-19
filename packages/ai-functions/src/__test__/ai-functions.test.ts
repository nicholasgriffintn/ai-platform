import type {
  AIProvider,
  ChatCompletionParameters,
  DecisionRequest,
  ProviderRuntime,
} from "@ngriffin_uk/polychat-ai-providers";
import { describe, expect, it, vi } from "vitest";
import z from "zod/v4";

import { defineFunctions } from "../functions.js";
import { createAiFunctions } from "../index.js";

const env = { API_BASE_URL: "https://api.test" };
const user = { id: 7, plan_id: "pro" };

type GetResponse = (params: ChatCompletionParameters, userId?: number) => Promise<unknown>;

function lastParams(getResponse: ReturnType<typeof vi.fn<GetResponse>>): ChatCompletionParameters {
  const params = getResponse.mock.calls.at(-1)?.[0];

  if (!params) {
    throw new Error("provider was not called");
  }

  return params;
}

function createRuntime(getResponse: GetResponse, options: { decisionTarget?: boolean } = {}) {
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
                probabilities: { [Object.keys(question.criteria)[0]]: 1 },
                confidence: 1,
              }
            : question.type === "score"
              ? {
                  type: "score",
                  score: 1.5,
                  legend: { "0": "a", "1": "b" },
                  probabilities: { "0": 0.5, "1": 0.5 },
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
        findModelConfig: vi.fn(async (model: string) =>
          model === "gpt-5" ? ({ matchingModel: "gpt-5", provider: "openai" } as never) : null,
        ),
        resolveModelProvider: vi.fn(
          async ({ provider, defaultProvider }) => provider ?? defaultProvider,
        ),
        getAuxiliaryDecisionModel: vi.fn(async () =>
          options.decisionTarget ? { model: "jev-latest", provider: "typesafe" } : null,
        ),
      } as never,
      storage: { forEnv: () => null, forContext: () => null },
      keyStore: () => undefined,
    },
    providers: { resolve: resolve as never },
  };

  return { runtime, chat, image, replicate, resolve, decision };
}

describe("createAiFunctions", () => {
  it("resolves the provider from the model and returns the completion text", async () => {
    const getResponse = vi.fn<GetResponse>(async () => ({ response: "  Hello there " }));
    const { runtime } = createRuntime(getResponse);
    const ai = createAiFunctions(runtime);

    const result = await ai.complete({ env, user, model: "gpt-5", prompt: "Say hello" });

    expect(result).toMatchObject({ text: "Hello there", model: "gpt-5", provider: "openai" });

    const params = lastParams(getResponse);

    expect(params.messages).toEqual([{ role: "user", content: "Say hello" }]);
    expect(params.context).toEqual({ env, user });
    expect(params.stream).toBe(false);
  });

  it("rejects unknown models before touching a provider", async () => {
    const { runtime, resolve } = createRuntime(vi.fn<GetResponse>());
    const ai = createAiFunctions(runtime);

    await expect(ai.generateText({ env, model: "nope", prompt: "x" })).rejects.toMatchObject({
      type: "PARAMS_ERROR",
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it("requests structured output and validates it against the schema", async () => {
    const getResponse = vi.fn<GetResponse>(async () => ({
      response: '```json\n{"items": ["a", "b", "c"]}\n```',
    }));
    const { runtime } = createRuntime(getResponse);
    const ai = createAiFunctions(runtime);

    await expect(ai.list({ env, model: "gpt-5", prompt: "letters", count: 2 })).resolves.toEqual([
      "a",
      "b",
    ]);

    const params = lastParams(getResponse);

    expect(params.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "list", strict: true, schema: { type: "object", required: ["items"] } },
    });
  });

  it("relaxes strict mode when the schema has optional properties", async () => {
    const getResponse = vi.fn<GetResponse>(async () => ({ response: '{"title": "Perch"}' }));
    const { runtime } = createRuntime(getResponse);
    const ai = createAiFunctions(runtime);

    await ai.generateObject({
      env,
      model: "gpt-5",
      prompt: "describe",
      schema: z.object({ title: z.string(), summary: z.string().optional() }),
    });

    expect(lastParams(getResponse).response_format).toMatchObject({
      json_schema: { strict: false },
    });
  });

  it("reports schema mismatches as provider errors", async () => {
    const { runtime } = createRuntime(
      vi.fn<GetResponse>(async () => ({ response: '{"label": "other"}' })),
    );
    const ai = createAiFunctions(runtime);

    await expect(
      ai.classify({ env, model: "gpt-5", input: "hi", labels: ["greeting", "farewell"] }),
    ).rejects.toMatchObject({ type: "PROVIDER_ERROR" });
  });

  it("builds typed functions from plain shapes", async () => {
    const getResponse = vi.fn<GetResponse>(async () => ({
      response: '{"title": "Perch", "tags": ["birds", "nests"]}',
    }));
    const { runtime } = createRuntime(getResponse);
    const functions = defineFunctions(createAiFunctions(runtime), {
      describeNest: {
        description: "Describe a nest",
        output: { title: "a short title", tags: ["tags for the nest"] },
      },
    });

    const result = await functions.describeNest("a parrot nest", { env, model: "gpt-5" });

    expect(result).toEqual({ title: "Perch", tags: ["birds", "nests"] });
    expect(result.tags[0]).toBe("birds");
  });

  it("falls back to the default media provider when the requested one fails", async () => {
    const { runtime, image, replicate } = createRuntime(vi.fn<GetResponse>());
    const ai = createAiFunctions(runtime);

    await expect(
      ai.image({ env, user, prompt: "a parrot" }, { provider: "replicate" }),
    ).resolves.toEqual({ url: "https://img" });
    expect(replicate.generate).toHaveBeenCalledTimes(1);
    expect(image.generate).toHaveBeenCalledTimes(1);

    await expect(
      ai.image({ env, user, prompt: "a parrot" }, { provider: "replicate", allowFallback: false }),
    ).rejects.toThrow("replicate down");
  });

  it("routes classify and is through the decision provider when one resolves", async () => {
    const getResponse = vi.fn<GetResponse>();
    const { runtime, decision } = createRuntime(getResponse, { decisionTarget: true });
    const ai = createAiFunctions(runtime);

    await expect(
      ai.classify({ env, user, input: "hello", labels: ["greeting", "farewell"] }),
    ).resolves.toBe("greeting");
    await expect(ai.is({ env, user, statement: "the sky is blue" })).resolves.toBe(true);
    await expect(ai.is({ env, user, statement: "the sky is blue", threshold: 0.95 })).resolves.toBe(
      false,
    );
    expect(getResponse).not.toHaveBeenCalled();
    expect(decision.decide).toHaveBeenCalledTimes(3);
    expect(decision.decide.mock.calls[0]?.[0]).toMatchObject({
      state: "hello",
      questions: { label: { type: "choice", criteria: { greeting: null, farewell: null } } },
    });
  });

  it("falls back to the chat model when no decision target resolves", async () => {
    const getResponse = vi.fn<GetResponse>(async () => ({ response: '{"label": "farewell"}' }));
    const { runtime, decision } = createRuntime(getResponse);
    const ai = createAiFunctions(runtime);
    const questions = { q: { type: "noul", instructions: "?" } } as const;

    await expect(
      ai.classify({ env, model: "gpt-5", input: "bye", labels: ["greeting", "farewell"] }),
    ).resolves.toBe("farewell");
    expect(decision.decide).not.toHaveBeenCalled();
    await expect(ai.tryDecide({ env, state: "x", questions })).resolves.toBeNull();
    await expect(ai.decide({ env, state: "x", questions })).rejects.toMatchObject({
      type: "CONFIGURATION_ERROR",
    });
  });

  it("returns typed answers from decide and honours an explicit provider", async () => {
    const { runtime, decision } = createRuntime(vi.fn<GetResponse>());
    const ai = createAiFunctions(runtime);

    const result = await ai.decide({
      env,
      user,
      provider: "typesafe",
      model: "jev-1.13.0",
      state: { message: "refund please" },
      questions: {
        wants_refund: { type: "noul", instructions: "Does `message` ask for a refund?" },
        tone: { type: "choice", instructions: "Tone?", criteria: { calm: null, angry: null } },
      },
    });

    expect(result.answers.wants_refund.noul).toBe(0.93);
    expect(result.answers.tone.choice).toBe("calm");
    expect(result.usage).toEqual({ input_tokens: 42, output_tokens: 3 });
    expect(decision.decide.mock.calls[0]?.[0]).toMatchObject({ model: "jev-1.13.0" });
  });

  it("renders template literals into a prompt", async () => {
    const getResponse = vi.fn<GetResponse>(async () => ({ response: "ok" }));
    const { runtime } = createRuntime(getResponse);
    const ai = createAiFunctions(runtime);
    const prompt = ai.template({ env, model: "gpt-5" });

    await expect(prompt`Name ${3} birds`).resolves.toBe("ok");
    expect(lastParams(getResponse).messages).toEqual([{ role: "user", content: "Name 3 birds" }]);
  });
});
