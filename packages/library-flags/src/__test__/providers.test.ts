import { describe, expect, it, vi } from "vitest";

import { bucketFor, pickWeighted } from "../bucketing.js";
import { createFlagshipProvider, type FlagshipBinding } from "../flagship.js";
import { createLayeredProvider } from "../layered.js";
import { createRulesProvider, type FlagRule } from "../rules.js";

const rules: Record<string, FlagRule> = {
  "chat-tone": {
    key: "chat-tone",
    variants: { control: "control", playful: "playful" },
    defaultVariant: "control",
    split: { control: 50, playful: 50 },
    target: (context) => (context.plan === "pro" ? "playful" : undefined),
  },
  "memory-synthesis": {
    key: "memory-synthesis",
    variants: { on: true, off: false },
    defaultVariant: "on",
    enabled: (context) => context.region !== "eu",
  },
  "model-settings": {
    key: "model-settings",
    variants: { default: { temperature: 0.7 } },
    defaultVariant: "default",
  },
};

const provider = createRulesProvider((key) => rules[key]);

describe("bucketing", () => {
  it("is deterministic per key and salt and spreads users across the range", async () => {
    const first = await bucketFor("user:1", "chat-tone");

    expect(await bucketFor("user:1", "chat-tone")).toBe(first);
    expect(await bucketFor("user:1", "other")).not.toBe(first);

    const buckets = await Promise.all(
      Array.from({ length: 400 }, (_, index) => bucketFor(`user:${index}`, "chat-tone")),
    );
    const low = buckets.filter((bucket) => bucket < 0.5).length;

    expect(low).toBeGreaterThan(150);
    expect(low).toBeLessThan(250);
  });

  it("maps a bucket onto cumulative weights", () => {
    const entries = [
      { key: "a", weight: 30 },
      { key: "b", weight: 40 },
      { key: "c", weight: 30 },
    ];

    expect(pickWeighted(0, entries)).toBe("a");
    expect(pickWeighted(0.299, entries)).toBe("a");
    expect(pickWeighted(0.3, entries)).toBe("b");
    expect(pickWeighted(0.7, entries)).toBe("c");
    expect(pickWeighted(0.999, entries)).toBe("c");
    expect(pickWeighted(0.5, [{ key: "zero", weight: 0 }])).toBeUndefined();
  });
});

describe("createRulesProvider", () => {
  it("splits users deterministically and lets targeting win over the split", async () => {
    const split = await provider.resolve("chat-tone", "control", { targetingKey: "user:7" });
    const again = await provider.resolve("chat-tone", "control", { targetingKey: "user:7" });
    const targeted = await provider.resolve("chat-tone", "control", {
      targetingKey: "user:7",
      plan: "pro",
    });

    expect(split.reason).toBe("SPLIT");
    expect(split.variant).toBe(again.variant);
    expect(targeted).toMatchObject({
      value: "playful",
      variant: "playful",
      reason: "TARGETING_MATCH",
    });
  });

  it("falls back to the default variant without a targeting key and reports why", async () => {
    await expect(provider.resolve("chat-tone", "control", {})).resolves.toMatchObject({
      value: "control",
      reason: "DEFAULT",
      errorCode: "TARGETING_KEY_MISSING",
    });
  });

  it("reports disabled, missing and mistyped flags", async () => {
    await expect(
      provider.resolve("memory-synthesis", false, { region: "eu" }),
    ).resolves.toMatchObject({ value: true, variant: "on", reason: "DISABLED" });
    await expect(provider.resolve("memory-synthesis", false, {})).resolves.toMatchObject({
      value: true,
      reason: "STATIC",
    });
    await expect(provider.resolve("nope", 3, {})).resolves.toMatchObject({
      value: 3,
      reason: "DEFAULT",
      errorCode: "FLAG_NOT_FOUND",
    });
    await expect(provider.resolve("model-settings", "text", {})).resolves.toMatchObject({
      value: "text",
      reason: "ERROR",
      errorCode: "TYPE_MISMATCH",
    });
    await expect(provider.resolve("model-settings", { temperature: 1 }, {})).resolves.toMatchObject(
      { value: { temperature: 0.7 }, reason: "STATIC" },
    );
  });
});

describe("createFlagshipProvider", () => {
  function binding(overrides: Partial<FlagshipBinding> = {}): FlagshipBinding {
    const unsupported = async () => {
      throw new Error("unsupported");
    };

    return {
      get: unsupported,
      getBooleanDetails: unsupported,
      getStringDetails: unsupported,
      getNumberDetails: unsupported,
      getObjectDetails: unsupported,
      ...overrides,
    };
  }

  it("maps details, strips non-primitive context and surfaces binding failures as defaults", async () => {
    const getStringDetails = vi.fn(async (flagKey: string, defaultValue: string) => ({
      flagKey,
      value: "playful",
      variant: "playful",
      reason: "TARGETING_MATCH",
      defaultValue,
    }));
    const flagship = createFlagshipProvider(binding({ getStringDetails }));

    await expect(
      flagship.resolve("chat-tone", "control", { targetingKey: "user:1", empty: null }),
    ).resolves.toMatchObject({ value: "playful", variant: "playful", reason: "TARGETING_MATCH" });
    expect(getStringDetails).toHaveBeenCalledWith("chat-tone", "control", {
      targetingKey: "user:1",
    });

    await expect(flagship.resolve("other", true, {})).resolves.toMatchObject({
      value: true,
      reason: "ERROR",
      errorCode: "GENERAL",
      errorMessage: "unsupported",
    });
    await expect(
      createFlagshipProvider(
        binding({
          getBooleanDetails: async (flagKey, defaultValue) => ({
            flagKey,
            value: defaultValue,
            reason: "DEFAULT",
            errorCode: "FLAG_NOT_FOUND",
          }),
        }),
      ).resolve("missing", false, {}),
    ).resolves.toMatchObject({ reason: "DEFAULT", errorCode: "FLAG_NOT_FOUND" });
  });
});

describe("createLayeredProvider", () => {
  it("lets the first provider that resolves win and falls through otherwise", async () => {
    const dashboard = createRulesProvider((key) =>
      key === "chat-tone"
        ? {
            key,
            variants: { control: "control", playful: "playful" },
            defaultVariant: "control",
            target: () => "playful",
          }
        : undefined,
    );
    const layered = createLayeredProvider([dashboard, provider]);

    await expect(
      layered.resolve("chat-tone", "control", { targetingKey: "u" }),
    ).resolves.toMatchObject({
      variant: "playful",
      reason: "TARGETING_MATCH",
    });
    await expect(layered.resolve("memory-synthesis", false, {})).resolves.toMatchObject({
      value: true,
      reason: "STATIC",
    });
    await expect(layered.resolve("missing", 1, {})).resolves.toMatchObject({
      value: 1,
      errorCode: "FLAG_NOT_FOUND",
    });
  });
});
