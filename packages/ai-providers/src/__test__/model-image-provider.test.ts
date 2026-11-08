import { describe, expect, it, vi } from "vitest";

import { ModelImageProvider } from "../capabilities/image/providers/ModelImageProvider.js";
import { createProviderLibrary } from "../create-library.js";
import { createTestHost, createTestRuntime } from "./test-runtime.js";

const env = { API_BASE_URL: "https://api.example.test" };
const user = { id: 7, plan_id: "pro" };

function runtimeWithChat(getResponse: (...args: unknown[]) => Promise<unknown>) {
  const resolve = vi.fn(() => ({ getResponse }));

  return { runtime: createTestRuntime({}, { resolve: resolve as never }), resolve };
}

describe("ModelImageProvider", () => {
  it("is available for every provider whose models can return pictures", () => {
    const library = createProviderLibrary({ host: createTestHost() });

    for (const provider of ["openai", "google", "grok", "openrouter", "workers-ai", "replicate"]) {
      expect(library.resolve("image", provider, {})).toBeInstanceOf(ModelImageProvider);
    }
  });

  it("draws through the model's own provider and returns the stored picture", async () => {
    const getResponse = vi.fn().mockResolvedValue({
      response: [{ type: "image_url", image_url: { url: "https://api.example.test/o/abc" } }],
    });
    const { runtime, resolve } = runtimeWithChat(getResponse);

    const result = await new ModelImageProvider(runtime, "openai").generate({
      prompt: "A heron on a branch",
      model: "gpt-image-2.6-flare",
      env,
      user,
    });

    expect(result.url).toBe("https://api.example.test/o/abc");
    expect(resolve).toHaveBeenCalledWith("chat", "openai", expect.anything());
    expect(getResponse).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-image-2.6-flare" }),
    );
  });

  it("fails when the model returns no picture", async () => {
    const { runtime } = runtimeWithChat(async () => ({ response: "Sorry" }));

    await expect(
      new ModelImageProvider(runtime, "openai").generate({
        prompt: "A heron",
        model: "gpt-image-2.6-flare",
        env,
        user,
      }),
    ).rejects.toThrow("returned no picture");
  });
});
