import { describe, expect, it } from "vitest";

import type { ChatCompletionParameters, IEnv } from "~/types";

import { BedrockProvider } from "./bedrock";

const provider = new BedrockProvider();

function requestFor(overrides: Partial<ChatCompletionParameters>): ChatCompletionParameters {
  return {
    env: Object.assign(Object.create(null), {}) as IEnv,
    provider: "bedrock",
    messages: [{ role: "user", content: "Plan the migration." }],
    disable_functions: true,
    stream: false,
    ...overrides,
  };
}

describe("BedrockProvider.mapParameters", () => {
  it("asks an adaptive Claude to think with an effort and drops sampling", async () => {
    const body = await provider.mapParameters(
      requestFor({
        model: "anthropic.claude-opus-5",
        reasoning_effort: "high",
        temperature: 0.7,
        top_p: 0.9,
      }),
    );

    expect(body.additionalModelRequestFields).toEqual({
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
    });
    expect(body.inferenceConfig.temperature).toBeUndefined();
    expect(body.inferenceConfig.topP).toBeUndefined();
  });

  it("keeps a budget Claude's thinking allowance below its output allowance", async () => {
    const body = await provider.mapParameters(
      requestFor({
        model: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
        reasoning_effort: "thinking",
      }),
    );

    const thinking = body.additionalModelRequestFields.thinking;

    expect(thinking.type).toBe("enabled");
    expect(thinking.budget_tokens).toBeGreaterThanOrEqual(1024);
    expect(thinking.budget_tokens).toBeLessThan(body.inferenceConfig.maxTokens);
  });

  it("keeps the Anthropic thinking shape away from the other Bedrock families", async () => {
    const body = await provider.mapParameters(
      requestFor({
        model: "openai.gpt-oss-120b-1:0",
        reasoning_effort: "high",
      }),
    );

    expect(body.additionalModelRequestFields).toBeUndefined();
  });

  it("sends no reasoning payload when the effort is off", async () => {
    const body = await provider.mapParameters(
      requestFor({
        model: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
        reasoning_effort: "none",
      }),
    );

    expect(body.additionalModelRequestFields).toBeUndefined();
  });
});
