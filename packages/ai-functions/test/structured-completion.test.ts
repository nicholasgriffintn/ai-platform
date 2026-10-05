import {
  ProviderLibrary,
  type AiProviderMap,
  type ProviderFactoryContext,
  type ProviderRuntime,
} from "@ngriffin_uk/polychat-ai-providers";
import { describe, expect, it, vi } from "vitest";
import z from "zod/v4";

import { createAi } from "../src/ai";
import type { CompletionResult } from "../src/types";

describe("structured completion usage", () => {
  it.each(["invalid-json", '{"count": "invalid"}'])(
    "preserves usage accounting when the structured response is invalid: %s",
    async (response) => {
      const usage = { input_tokens: 12, output_tokens: 3 };
      const providers = new ProviderLibrary<AiProviderMap, ProviderFactoryContext>();

      providers.register("chat", {
        name: "mock",
        create: () => ({
          name: "mock",
          supportsStreaming: false,
          getResponse: async () => ({ response, usage }),
        }),
      });
      const runtime: ProviderRuntime = {
        get host(): never {
          throw new Error("The explicit provider must not resolve a different model");
        },
        providers,
      };
      const account = vi
        .fn<(result: CompletionResult) => Promise<void>>()
        .mockResolvedValue(undefined);

      await expect(
        createAi(runtime).generateObject(
          {
            env: {},
            model: "mock-model",
            provider: "mock",
            prompt: "Return a count",
            schema: z.object({ count: z.number() }),
          },
          account,
        ),
      ).rejects.toMatchObject({ type: "PROVIDER_ERROR" });
      expect(account).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ usage, model: "mock-model", provider: "mock" }),
      );
    },
  );
});
