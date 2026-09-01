import type { UsageUnit } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import type { MessagePart } from "~/types";

import { extractProviderBillableUsage, type ProviderBillableUnit } from "../providerBillableUnits";
import { normaliseTokenUsage } from "../tokenUsage";

function hasRateFor(units: readonly UsageUnit[] = []) {
  return (unit: UsageUnit) => units.includes(unit);
}

function extract(
  provider: string,
  raw: Record<string, unknown>,
  overrides: {
    ratedUnits?: readonly UsageUnit[];
    parts?: MessagePart[];
    structuredData?: unknown;
    serviceTier?: string;
  } = {},
) {
  return extractProviderBillableUsage(
    provider,
    {
      usage: normaliseTokenUsage(raw),
      raw,
      parts: overrides.parts,
      structuredData: overrides.structuredData,
      serviceTier: overrides.serviceTier,
    },
    { hasRate: hasRateFor(overrides.ratedUnits) },
  );
}

function quantityOf(units: ProviderBillableUnit[], unit: UsageUnit): number | undefined {
  return units.find((entry) => entry.unit === unit)?.quantity;
}

function toolUsePart(name: string, toolCallId: string): MessagePart {
  return { type: "tool_use", name, toolCallId };
}

describe("anthropic extraction", () => {
  const raw = {
    input_tokens: 1000,
    output_tokens: 200,
    cache_read_input_tokens: 300,
    cache_creation_input_tokens: 500,
    cache_creation: {
      ephemeral_5m_input_tokens: 400,
      ephemeral_1h_input_tokens: 100,
    },
    server_tool_use: {
      web_search_requests: 3,
      web_fetch_requests: 2,
    },
    service_tier: "priority",
  };

  it("splits cache writes into 5m and 1h tiers instead of a summed figure", () => {
    const { units } = extract("anthropic", raw);

    expect(quantityOf(units, "cache_write_5m_tokens")).toBe(400);
    expect(quantityOf(units, "cache_write_1h_tokens")).toBe(100);
    expect(quantityOf(units, "cached_input_tokens")).toBe(300);
    expect(quantityOf(units, "input_tokens")).toBe(1000);
  });

  it("captures server tool usage as hosted tool units", () => {
    const { units } = extract("anthropic", raw);
    const webSearch = units.find((entry) => entry.unit === "web_search_requests");
    const webFetch = units.find((entry) => entry.unit === "web_fetch_requests");

    expect(webSearch).toMatchObject({ quantity: 3, source: "hosted_tool", resource: "web_search" });
    expect(webFetch).toMatchObject({ quantity: 2, source: "hosted_tool", resource: "web_fetch" });
  });

  it("reads the service tier from the usage payload", () => {
    expect(extract("anthropic", raw).tier).toBe("priority");
  });

  it("keeps the summed cache write when no tier breakdown is present", () => {
    const { units } = extract("anthropic", {
      input_tokens: 100,
      output_tokens: 10,
      cache_creation_input_tokens: 250,
    });

    expect(quantityOf(units, "cache_write_5m_tokens")).toBe(250);
    expect(quantityOf(units, "cache_write_1h_tokens")).toBeUndefined();
  });

  it("captures code execution seconds when the response reports them", () => {
    const { units } = extract("anthropic", {
      input_tokens: 100,
      output_tokens: 10,
      server_tool_use: { execution_time_seconds: 42 },
    });

    expect(quantityOf(units, "code_execution_seconds")).toBe(42);
  });
});

describe("openai extraction", () => {
  const raw = {
    input_tokens: 1000,
    output_tokens: 200,
    total_tokens: 1200,
    input_tokens_details: { cached_tokens: 400 },
  };

  it("counts hosted tool output items and treats code interpreter as one session", () => {
    const parts = [
      toolUsePart("search_grounding", "ws_1"),
      toolUsePart("search_grounding", "ws_2"),
      toolUsePart("file_search", "fs_1"),
      toolUsePart("code_execution", "ci_1"),
      toolUsePart("code_execution", "ci_2"),
      toolUsePart("image_generation", "ig_1"),
    ];

    const { units } = extract("openai", raw, { parts });

    expect(quantityOf(units, "web_search_requests")).toBe(2);
    expect(quantityOf(units, "file_search_requests")).toBe(1);
    expect(quantityOf(units, "image_generation_calls")).toBe(1);
    expect(units.find((entry) => entry.resource === "code_interpreter")).toMatchObject({
      unit: "requests",
      quantity: 1,
      source: "hosted_tool",
    });
  });

  it("ignores non-hosted tool parts and separates cached input as a subset", () => {
    const { units } = extract("openai", raw, {
      parts: [toolUsePart("my_custom_tool", "call_1"), { type: "text", text: "hello" }],
    });

    expect(units.filter((entry) => entry.source === "hosted_tool")).toHaveLength(0);
    expect(quantityOf(units, "input_tokens")).toBe(600);
    expect(quantityOf(units, "cached_input_tokens")).toBe(400);
  });

  it("uses the response service tier when the payload has none", () => {
    expect(extract("openai", raw, { serviceTier: "flex" }).tier).toBe("flex");
  });
});

describe("google extraction", () => {
  const raw = {
    promptTokenCount: 1000,
    candidatesTokenCount: 100,
    totalTokenCount: 1170,
    promptTokensDetails: [
      { modality: "TEXT", tokenCount: 600 },
      { modality: "IMAGE", tokenCount: 300 },
      { modality: "AUDIO", tokenCount: 100 },
    ],
    toolUsePromptTokenCount: 50,
  };

  it("splits rated modalities out of input tokens and leaves unrated ones in", () => {
    const { units } = extract("google-ai-studio", raw, { ratedUnits: ["image_input_tokens"] });

    expect(quantityOf(units, "image_input_tokens")).toBe(300);
    expect(quantityOf(units, "audio_input_tokens")).toBeUndefined();
    expect(quantityOf(units, "input_tokens")).toBe(750);
  });

  it("folds tool use prompt tokens into input when no dedicated rate exists", () => {
    const { units } = extract("google-ai-studio", raw);

    expect(quantityOf(units, "input_tokens")).toBe(1050);
    expect(quantityOf(units, "tool_use_prompt_tokens")).toBeUndefined();
  });

  it("charges tool use prompt tokens separately when rated", () => {
    const { units } = extract("google-ai-studio", raw, {
      ratedUnits: ["tool_use_prompt_tokens"],
    });

    expect(quantityOf(units, "tool_use_prompt_tokens")).toBe(50);
    expect(quantityOf(units, "input_tokens")).toBe(1000);
  });

  it("counts a grounded response as one grounded request", () => {
    const { units } = extract("google-ai-studio", raw, {
      structuredData: { searchGrounding: { webSearchQueries: ["polychat"] } },
    });

    expect(units.find((entry) => entry.unit === "grounded_requests")).toMatchObject({
      quantity: 1,
      source: "hosted_tool",
      resource: "grounding",
    });
  });
});

describe("xai extraction", () => {
  it("captures live search sources", () => {
    const { units } = extract("grok", {
      prompt_tokens: 100,
      completion_tokens: 50,
      num_sources_used: 5,
    });

    expect(units.find((entry) => entry.unit === "search_sources")).toMatchObject({
      quantity: 5,
      source: "hosted_tool",
      resource: "live_search",
    });
  });
});

describe("perplexity extraction", () => {
  it("adds citation tokens to output when the total shows they were not counted", () => {
    const { units } = extract("perplexity-ai", {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
      citation_tokens: 200,
      num_search_queries: 2,
    });

    expect(quantityOf(units, "output_tokens")).toBe(250);
    expect(quantityOf(units, "search_queries")).toBe(2);
  });

  it("leaves output tokens alone when the total already includes citations", () => {
    const { units } = extract("perplexity-ai", {
      prompt_tokens: 100,
      completion_tokens: 250,
      total_tokens: 550,
      citation_tokens: 200,
    });

    expect(quantityOf(units, "output_tokens")).toBe(250);
  });
});

describe("cohere extraction", () => {
  it("captures billed search units", () => {
    const { units } = extract("cohere", {
      billed_units: { input_tokens: 100, output_tokens: 50, search_units: 1 },
    });

    expect(units.find((entry) => entry.unit === "search_units")).toMatchObject({
      quantity: 1,
      source: "hosted_tool",
      resource: "search",
    });
  });
});

describe("deepseek extraction", () => {
  it("separates cache hits from misses", () => {
    const { units } = extract("deepseek", {
      prompt_tokens: 1000,
      completion_tokens: 100,
      total_tokens: 1100,
      prompt_cache_hit_tokens: 600,
      prompt_cache_miss_tokens: 400,
    });

    expect(quantityOf(units, "cached_input_tokens")).toBe(600);
    expect(quantityOf(units, "input_tokens")).toBe(400);
  });
});

describe("openrouter extraction", () => {
  const rawWithCost = {
    prompt_tokens: 1000,
    completion_tokens: 100,
    total_tokens: 1100,
    cost: 0.0123,
    cost_details: { upstream_inference_cost: null },
  };

  it("replaces derived token pricing with the reported cost", () => {
    const { units } = extract("openrouter", rawWithCost);

    expect(units).toEqual([{ unit: "usd_micros", quantity: 12300, source: "model" }]);
  });

  it("adds the upstream inference cost when the request ran through BYOK", () => {
    const { units } = extract("openrouter", {
      ...rawWithCost,
      cost: 0.001,
      is_byok: true,
      cost_details: { upstream_inference_cost: 0.02 },
    });

    expect(units).toEqual([{ unit: "usd_micros", quantity: 21000, source: "model" }]);
  });

  it("falls back to token quantities when no cost is reported", () => {
    const { units } = extract("openrouter", {
      prompt_tokens: 1000,
      completion_tokens: 100,
      total_tokens: 1100,
    });

    expect(quantityOf(units, "input_tokens")).toBe(1000);
    expect(quantityOf(units, "output_tokens")).toBe(100);
    expect(quantityOf(units, "usd_micros")).toBeUndefined();
  });
});

describe("replicate extraction", () => {
  it("bills one run when a prediction reports compute time and the model has a run rate", () => {
    const { units } = extract(
      "replicate",
      { metrics: { predict_time: 3.2 } },
      { ratedUnits: ["requests"] },
    );

    expect(units).toEqual([{ unit: "requests", quantity: 1, source: "model" }]);
  });

  it("emits nothing when the model has no run rate", () => {
    const { units } = extract("replicate", { metrics: { predict_time: 3.2 } });

    expect(units).toHaveLength(0);
  });
});
