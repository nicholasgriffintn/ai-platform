import { describe, expect, it } from "vitest";

import type { ChatCompletionParameters } from "~/types";

import { GroqProvider } from "./groq";

describe("chat provider module graph", () => {
  it("initialises a leaf provider when base.ts is the entry into the module graph", async () => {
    const provider = new GroqProvider();

    const body = await provider.defaultMapParameters({
      model: "llama-3.3-70b-versatile",
      provider: "groq",
      messages: [{ role: "user", content: "hello" }],
      stream: false,
      disable_functions: true,
    } as unknown as ChatCompletionParameters);

    expect(body.model).toBe("groq/llama-3.3-70b-versatile");
    expect(body.messages).toHaveLength(1);
  });
});
