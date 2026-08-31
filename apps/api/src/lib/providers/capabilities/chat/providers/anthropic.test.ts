import { describe, expect, it } from "vitest";

import type { ChatCompletionParameters, ReasoningEffortLevel } from "~/types";

import { AnthropicProvider } from "./anthropic";

const provider = new AnthropicProvider();

function requestFor(model: string, reasoningEffort: ReasoningEffortLevel) {
  return {
    model,
    provider: "anthropic",
    messages: [{ role: "user", content: "hello" }],
    reasoning_effort: reasoningEffort,
    temperature: 0.4,
    top_p: 0.9,
    max_tokens: 10_000,
    stream: false,
    disable_functions: true,
  } as unknown as ChatCompletionParameters;
}

describe("AnthropicProvider.mapParameters", () => {
  it("asks an adaptive model to think with an effort instead of a token budget", async () => {
    const body = await provider.mapParameters(requestFor("claude-opus-5", "high"));

    expect(body.thinking).toEqual({ type: "adaptive" });
    expect(body.output_config).toEqual({ effort: "high" });
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("top_p");
    expect(body).not.toHaveProperty("top_k");
    expect(body.thinking).not.toHaveProperty("budget_tokens");
  });

  it("drops sampling parameters an adaptive model still advertises support for", async () => {
    const body = await provider.mapParameters(requestFor("claude-opus-4-6", "max"));

    expect(body.thinking).toEqual({ type: "adaptive" });
    expect(body.output_config).toEqual({ effort: "max" });
    expect(body).not.toHaveProperty("temperature");
  });

  it("keeps a token budget below max_tokens on a legacy model at the highest effort", async () => {
    const body = await provider.mapParameters(requestFor("claude-opus-4-5", "high"));

    expect(body.thinking.type).toBe("enabled");
    expect(body.thinking.budget_tokens).toBeLessThan(body.max_tokens);
    expect(body.temperature).toBe(1);
    expect(body).not.toHaveProperty("output_config");
  });

  it("sends no thinking when the effort is not one the model offers", async () => {
    const body = await provider.mapParameters(requestFor("claude-opus-5", "minimal"));

    expect(body).not.toHaveProperty("thinking");
    expect(body).not.toHaveProperty("output_config");
  });
});
