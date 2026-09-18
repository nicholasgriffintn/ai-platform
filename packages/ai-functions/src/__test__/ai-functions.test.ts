import type {
  AIProvider,
  ChatCompletionParameters,
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

function createRuntime(getResponse: GetResponse) {
  const chat: AIProvider = { name: "openai", supportsStreaming: true, getResponse };
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
      } as never,
      storage: { forEnv: () => null, forContext: () => null },
      keyStore: () => undefined,
    },
    providers: { resolve: resolve as never },
  };

  return { runtime, chat, image, replicate, resolve };
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

  it("renders template literals into a prompt", async () => {
    const getResponse = vi.fn<GetResponse>(async () => ({ response: "ok" }));
    const { runtime } = createRuntime(getResponse);
    const ai = createAiFunctions(runtime);
    const prompt = ai.template({ env, model: "gpt-5" });

    await expect(prompt`Name ${3} birds`).resolves.toBe("ok");
    expect(lastParams(getResponse).messages).toEqual([{ role: "user", content: "Name 3 birds" }]);
  });
});
