import { normaliseTokenUsage } from "@ngriffin_uk/polychat-ai-telemetry";
import type { MessagePart, UsageUnit } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  extractProviderBillableUsage,
  type ProviderBillableUnit,
} from "../provider-billable-units.js";

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
});

describe("openai extraction", () => {
  const raw = {
    input_tokens: 1000,
    output_tokens: 200,
    total_tokens: 1200,
    input_tokens_details: { cached_tokens: 400 },
  };

  it("ignores non-hosted tool parts and separates cached input as a subset", () => {
    const { units } = extract("openai", raw, {
      parts: [toolUsePart("my_custom_tool", "call_1"), { type: "text", text: "hello" }],
    });

    expect(units.filter((entry) => entry.source === "hosted_tool")).toHaveLength(0);
    expect(quantityOf(units, "input_tokens")).toBe(600);
    expect(quantityOf(units, "cached_input_tokens")).toBe(400);
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

  it("adds the upstream inference cost when the request ran through BYOK", () => {
    const { units } = extract("openrouter", {
      ...rawWithCost,
      cost: 0.001,
      is_byok: true,
      cost_details: { upstream_inference_cost: 0.02 },
    });

    expect(units).toEqual([{ unit: "usd_micros", quantity: 21000, source: "model" }]);
  });
});
