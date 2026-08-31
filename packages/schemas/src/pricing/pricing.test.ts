import { describe, expect, it, vi } from "vitest";

import type { ModelConfigItem } from "../models";
import { CLOUDFLARE_RATE_ENTRIES, CONTAINER_INSTANCE_TYPES } from "./cloudflare";
import { creditMicrosFromCostMicros, creditsFromCreditMicros } from "./constants";
import { rateEntriesFromModelConfig } from "./model-rates";
import { priceUsage, resolveRateEntry, type RateEntry } from "./rates";

const OCCURRED_AT = "2026-08-31T12:00:00.000Z";

function rate(overrides: Partial<RateEntry>): RateEntry {
  return {
    vendor: "anthropic",
    resource: "*",
    unit: "input_tokens",
    perUnitMicros: 1,
    effectiveFrom: "2026-01-01",
    ...overrides,
  };
}

describe("credit arithmetic", () => {
  it("converts vendor micro-USD into micro-credits at a hundred to one", () => {
    expect(creditMicrosFromCostMicros(10_000)).toBe(1_000_000);
    expect(creditsFromCreditMicros(creditMicrosFromCostMicros(10_000))).toBe(1);
  });

  it("applies the margin before rounding once", () => {
    expect(creditMicrosFromCostMicros(1234, 1.5)).toBe(185_100);
    expect(creditMicrosFromCostMicros(0.004)).toBe(0);
    expect(creditMicrosFromCostMicros(0.006)).toBe(1);
  });

  it("treats unusable input as zero rather than poisoning a balance with NaN", () => {
    expect(creditMicrosFromCostMicros(Number.NaN)).toBe(0);
    expect(creditMicrosFromCostMicros(100, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("rate resolution", () => {
  it("prefers an exact resource over the vendor default", () => {
    const entries = [
      rate({ resource: "*", perUnitMicros: 5 }),
      rate({ resource: "claude-4.6-opus", perUnitMicros: 9 }),
    ];

    expect(
      resolveRateEntry(entries, {
        vendor: "anthropic",
        resource: "claude-4.6-opus",
        unit: "input_tokens",
        occurredAt: OCCURRED_AT,
      })?.perUnitMicros,
    ).toBe(9);
  });

  it("takes the latest rate that was already in force when the work happened", () => {
    const entries = [
      rate({ resource: "m", perUnitMicros: 1, effectiveFrom: "2026-01-01" }),
      rate({ resource: "m", perUnitMicros: 2, effectiveFrom: "2026-06-01" }),
      rate({ resource: "m", perUnitMicros: 3, effectiveFrom: "2027-01-01" }),
    ];

    expect(
      resolveRateEntry(entries, {
        vendor: "anthropic",
        resource: "m",
        unit: "input_tokens",
        occurredAt: OCCURRED_AT,
      })?.perUnitMicros,
    ).toBe(2);
  });

  it("uses a tiered rate only for its own tier", () => {
    const entries = [
      rate({ resource: "m", perUnitMicros: 4 }),
      rate({ resource: "m", perUnitMicros: 8, tier: "priority" }),
    ];
    const query = {
      vendor: "anthropic",
      resource: "m",
      unit: "input_tokens" as const,
      occurredAt: OCCURRED_AT,
    };

    expect(resolveRateEntry(entries, { ...query, tier: "priority" })?.perUnitMicros).toBe(8);
    expect(resolveRateEntry(entries, query)?.perUnitMicros).toBe(4);
    expect(resolveRateEntry(entries, { ...query, tier: "flex" })?.perUnitMicros).toBe(4);
  });

  it("prices a miss at zero and flags it rather than throwing in a billing path", () => {
    const onMissingRate = vi.fn();
    const priced = priceUsage(
      [],
      {
        vendor: "anthropic",
        resource: "unknown",
        unit: "input_tokens",
        occurredAt: OCCURRED_AT,
      },
      1000,
      { onMissingRate },
    );

    expect(priced).toEqual({
      costMicros: 0,
      unitCostMicros: null,
      rateVersion: null,
      estimated: true,
    });
    expect(onMissingRate).toHaveBeenCalledTimes(1);
  });

  it("treats a direct provider cost as the cost itself", () => {
    expect(
      priceUsage(
        [],
        {
          vendor: "openai",
          resource: "responses",
          unit: "usd_micros",
          occurredAt: OCCURRED_AT,
        },
        4321.6,
      ),
    ).toEqual({ costMicros: 4322, unitCostMicros: 1, rateVersion: null, estimated: false });
  });
});

describe("cloudflare container pricing", () => {
  it("prices two hours of a basic container at the published list rate", () => {
    const spec = CONTAINER_INSTANCE_TYPES.basic;
    const seconds = 7200;
    const query = { vendor: "cloudflare", resource: "containers", occurredAt: OCCURRED_AT };

    const costMicros =
      priceUsage(
        CLOUDFLARE_RATE_ENTRIES,
        { ...query, unit: "container_vcpu_seconds" },
        spec.vcpu * seconds,
      ).costMicros +
      priceUsage(
        CLOUDFLARE_RATE_ENTRIES,
        { ...query, unit: "container_gib_seconds" },
        spec.memoryGib * seconds,
      ).costMicros +
      priceUsage(
        CLOUDFLARE_RATE_ENTRIES,
        { ...query, unit: "container_disk_gb_seconds" },
        spec.diskGb * seconds,
      ).costMicros;

    expect(creditsFromCreditMicros(creditMicrosFromCostMicros(costMicros))).toBeCloseTo(5.6, 2);
  });
});

function perUnit(entries: RateEntry[], unit: RateEntry["unit"]): number | undefined {
  return entries.find((entry) => entry.unit === unit)?.perUnitMicros;
}

describe("model catalogue rate adapter", () => {
  const model: ModelConfigItem = {
    id: "claude-4.6-opus",
    matchingModel: "claude-opus-4-6",
    provider: "anthropic",
    costPer1kInputTokens: 0.005,
    costPer1kOutputTokens: 0.025,
  };

  it("derives per-token micro-USD rates from the catalogue's per-1k prices", () => {
    const entries = rateEntriesFromModelConfig(model);

    expect(perUnit(entries, "input_tokens")).toBeCloseTo(5, 10);
    expect(perUnit(entries, "output_tokens")).toBeCloseTo(25, 10);
  });

  it("falls back to the provider cache multipliers when no cache price is declared", () => {
    const entries = rateEntriesFromModelConfig(model);

    expect(perUnit(entries, "cached_input_tokens")).toBeCloseTo(0.5, 10);
    expect(perUnit(entries, "cache_write_5m_tokens")).toBeCloseTo(6.25, 10);
    expect(perUnit(entries, "cache_write_1h_tokens")).toBeCloseTo(10, 10);
  });

  it("prefers an explicit cache price over the multiplier fallback", () => {
    const entries = rateEntriesFromModelConfig({
      ...model,
      costPer1kCachedInputTokens: 0.001,
    });

    expect(perUnit(entries, "cached_input_tokens")).toBeCloseTo(1, 10);
  });

  it("publishes a tier variant that only applies to that service tier", () => {
    const entries = rateEntriesFromModelConfig({
      ...model,
      serviceTierMultipliers: { priority: 2 },
    });
    const query = {
      vendor: "anthropic",
      resource: "claude-4.6-opus",
      unit: "input_tokens" as const,
      occurredAt: OCCURRED_AT,
    };

    expect(resolveRateEntry(entries, { ...query, tier: "priority" })?.perUnitMicros).toBeCloseTo(
      10,
      10,
    );
    expect(resolveRateEntry(entries, query)?.perUnitMicros).toBeCloseTo(5, 10);
  });
});
