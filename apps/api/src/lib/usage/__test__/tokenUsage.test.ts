import { describe, expect, it } from "vitest";

import { extractUsagePayload } from "../extractUsage";
import { mergeStreamedTokenUsage, normaliseTokenUsage, sumTokenUsage } from "../tokenUsage";

describe("normaliseTokenUsage", () => {
  it("normalises OpenAI chat completion usage with details", () => {
    expect(
      normaliseTokenUsage({
        prompt_tokens: 100,
        completion_tokens: 40,
        total_tokens: 140,
        prompt_tokens_details: { cached_tokens: 60, audio_tokens: 5 },
        completion_tokens_details: { reasoning_tokens: 12, audio_tokens: 3 },
      }),
    ).toEqual({
      input_tokens: 100,
      output_tokens: 40,
      total_tokens: 140,
      prompt_tokens: 100,
      completion_tokens: 40,
      cached_input_tokens: 60,
      reasoning_tokens: 12,
      audio_input_tokens: 5,
      audio_output_tokens: 3,
    });
  });

  it("normalises OpenAI responses api usage", () => {
    expect(
      normaliseTokenUsage({
        input_tokens: 812,
        output_tokens: 96,
        total_tokens: 908,
        input_tokens_details: { cached_tokens: 512 },
        output_tokens_details: { reasoning_tokens: 64 },
      }),
    ).toMatchObject({
      input_tokens: 812,
      output_tokens: 96,
      total_tokens: 908,
      cached_input_tokens: 512,
      reasoning_tokens: 64,
    });
  });

  it("normalises OpenAI cache writes without adding subset tokens to the total", () => {
    expect(
      normaliseTokenUsage({
        input_tokens: 1000,
        output_tokens: 100,
        total_tokens: 1100,
        input_tokens_details: { cached_tokens: 200, cache_write_tokens: 300 },
      }),
    ).toMatchObject({
      input_tokens: 1000,
      output_tokens: 100,
      total_tokens: 1100,
      cached_input_tokens: 200,
      cache_creation_tokens: 300,
    });
  });

  it("counts anthropic cache tokens on top of input tokens", () => {
    expect(
      normaliseTokenUsage({
        input_tokens: 10,
        output_tokens: 25,
        cache_read_input_tokens: 400,
        cache_creation_input_tokens: 120,
      }),
    ).toMatchObject({
      input_tokens: 10,
      output_tokens: 25,
      cached_input_tokens: 400,
      cache_creation_tokens: 120,
      total_tokens: 555,
    });
  });

  it("sums the anthropic cache creation breakdown", () => {
    expect(
      normaliseTokenUsage({
        input_tokens: 4,
        output_tokens: 6,
        cache_creation: {
          ephemeral_5m_input_tokens: 30,
          ephemeral_1h_input_tokens: 70,
        },
      }),
    ).toMatchObject({ cache_creation_tokens: 100, total_tokens: 110 });
  });

  it("keeps the google reported total which includes thinking tokens", () => {
    expect(
      normaliseTokenUsage({
        promptTokenCount: 300,
        candidatesTokenCount: 50,
        thoughtsTokenCount: 120,
        cachedContentTokenCount: 200,
        totalTokenCount: 470,
      }),
    ).toMatchObject({
      input_tokens: 300,
      output_tokens: 50,
      total_tokens: 470,
      reasoning_tokens: 120,
      cached_input_tokens: 200,
    });
  });

  it("normalises bedrock converse usage", () => {
    expect(
      normaliseTokenUsage({
        inputTokens: 210,
        outputTokens: 90,
        totalTokens: 300,
        cacheReadInputTokens: 1000,
        cacheWriteInputTokens: 500,
      }),
    ).toMatchObject({
      input_tokens: 210,
      output_tokens: 90,
      total_tokens: 1800,
      cached_input_tokens: 1000,
      cache_creation_tokens: 500,
    });
  });

  it("normalises the cohere nested token counts", () => {
    expect(
      normaliseTokenUsage({
        billed_units: { input_tokens: 12, output_tokens: 34 },
        tokens: { input_tokens: 120, output_tokens: 340 },
      }),
    ).toMatchObject({ input_tokens: 120, output_tokens: 340, total_tokens: 460 });
  });

  it("normalises ollama eval counts", () => {
    expect(normaliseTokenUsage({ prompt_eval_count: 26, eval_count: 298 })).toMatchObject({
      input_tokens: 26,
      output_tokens: 298,
      total_tokens: 324,
    });
  });

  it("never reports a total below the sum of its parts", () => {
    expect(
      normaliseTokenUsage({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 3 }),
    ).toMatchObject({
      total_tokens: 15,
    });
  });

  it("returns null when no token fields are present", () => {
    expect(normaliseTokenUsage({ latency: 12 })).toBeNull();
    expect(normaliseTokenUsage(undefined)).toBeNull();
  });
});

describe("extractUsagePayload", () => {
  it("reads anthropic usage from the message_start event", () => {
    expect(
      extractUsagePayload({
        type: "message_start",
        message: { usage: { input_tokens: 2095, output_tokens: 1 } },
      }),
    ).toEqual({ input_tokens: 2095, output_tokens: 1 });
  });

  it("reads usage from the openai responses completed event", () => {
    expect(
      extractUsagePayload({
        type: "response.completed",
        response: { usage: { input_tokens: 5, output_tokens: 7, total_tokens: 12 } },
      }),
    ).toMatchObject({ total_tokens: 12 });
  });

  it("reads cohere message-end usage", () => {
    expect(
      extractUsagePayload({
        type: "message-end",
        delta: { usage: { tokens: { input_tokens: 3, output_tokens: 4 } } },
      }),
    ).toMatchObject({ tokens: { input_tokens: 3, output_tokens: 4 } });
  });

  it("reads groq stream usage", () => {
    expect(
      extractUsagePayload({
        choices: [],
        x_groq: { usage: { prompt_tokens: 11, completion_tokens: 2, total_tokens: 13 } },
      }),
    ).toMatchObject({ total_tokens: 13 });
  });

  it("reads bedrock invocation metrics", () => {
    expect(
      extractUsagePayload({
        "amazon-bedrock-invocationMetrics": { inputTokenCount: 8, outputTokenCount: 9 },
      }),
    ).toMatchObject({ inputTokenCount: 8 });
  });

  it("reads google usage metadata", () => {
    expect(
      extractUsagePayload({ usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 6 } }),
    ).toMatchObject({ promptTokenCount: 4 });
  });

  it("returns null for content-only chunks", () => {
    expect(extractUsagePayload({ choices: [{ delta: { content: "hi" } }] })).toBeNull();
  });
});

describe("mergeStreamedTokenUsage", () => {
  it("keeps anthropic input tokens when later deltas only carry output tokens", () => {
    const start = mergeStreamedTokenUsage(null, { input_tokens: 2095, output_tokens: 1 });
    const end = mergeStreamedTokenUsage(start, { output_tokens: 503 });

    expect(end).toMatchObject({
      input_tokens: 2095,
      output_tokens: 503,
      total_tokens: 2598,
    });
  });

  it("does not double count cumulative google chunks", () => {
    const first = mergeStreamedTokenUsage(null, {
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
    });
    const second = mergeStreamedTokenUsage(first, {
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
    });

    expect(second).toMatchObject({ input_tokens: 10, output_tokens: 20, total_tokens: 30 });
  });
});

describe("sumTokenUsage", () => {
  it("adds usage across agent steps", () => {
    const first = sumTokenUsage(null, { prompt_tokens: 100, completion_tokens: 20 });
    const second = sumTokenUsage(first, {
      input_tokens: 150,
      output_tokens: 30,
      cache_read_input_tokens: 40,
    });

    expect(second).toMatchObject({
      input_tokens: 250,
      output_tokens: 50,
      cached_input_tokens: 40,
    });
  });
});
