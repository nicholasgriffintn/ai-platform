import type { TelemetryEvent } from "@ngriffin_uk/polychat-ai-telemetry";
import { createRulesProvider } from "@ngriffin_uk/polychat-library-flags";
import { describe, expect, it, vi } from "vitest";

import { createDefinitionRegistry, defineExperiment, defineFlag } from "../define.js";
import { createExperiments } from "../experiments.js";
import { cartesian, cartesianCount, gridVariants, runExperiment } from "../offline.js";

const tone = defineExperiment({
  key: "chat-tone",
  variants: {
    control: { temperature: 0.7, system: "You are helpful." },
    playful: { temperature: 0.9, system: "You are a witty parrot." },
  },
  control: "control",
  weights: { control: 1, playful: 3 },
  target: (context) => (context.plan === "free" ? "control" : undefined),
});

const memorySynthesis = defineFlag({
  key: "memory-synthesis",
  defaultValue: true,
  variants: { on: true, off: false },
  enabled: (context) => context.region !== "eu",
});

const registry = createDefinitionRegistry([tone, memorySynthesis]);
const provider = createRulesProvider(registry.rule);

function capturingTelemetry() {
  const events: TelemetryEvent[] = [];

  return { events, telemetry: { capture: (event: TelemetryEvent) => void events.push(event) } };
}

describe("definitions", () => {
  it("validates keys, variants and defaults", () => {
    expect(() => defineFlag({ key: "Bad Key", defaultValue: true })).toThrow(/lowercase/);
    expect(() =>
      defineFlag({ key: "orphan", defaultValue: true, variants: { off: false } }),
    ).toThrow(/default/);
    expect(() => defineExperiment({ key: "one", variants: { only: 1 }, control: "only" })).toThrow(
      /two variants/,
    );
    expect(() => createDefinitionRegistry([tone, tone])).toThrow(/defined twice/);
    expect(registry.rule("chat-tone")).toMatchObject({
      variants: { control: "control", playful: "playful" },
      split: { control: 1, playful: 3 },
      defaultVariant: "control",
    });
  });
});

describe("createExperiments", () => {
  it("assigns a typed variant, exposes once per variant and tags outcomes", async () => {
    const { events, telemetry } = capturingTelemetry();
    const onAssign = vi.fn();
    const experiments = createExperiments({
      provider,
      context: { targetingKey: "user:42", plan: "pro" },
      telemetry,
      onAssign,
    });

    const first = await experiments.assign(tone);
    const second = await experiments.assign(tone);

    expect(first.variant).toBe(second.variant);
    expect(first.config.temperature).toBe(tone.variants[first.variant].temperature);
    expect(first.reason).toBe("SPLIT");
    expect(first.exposed).toBe(true);
    expect(second.exposed).toBe(false);
    expect(onAssign).toHaveBeenCalledTimes(2);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      name: "feature_flag.evaluation",
      distinctId: "user:42",
      properties: {
        "feature_flag.key": "chat-tone",
        "feature_flag.result.variant": first.variant,
        "feature_flag.result.reason": "SPLIT",
        "feature_flag.provider.name": "rules",
        "feature_flag.context.id": "user:42",
      },
    });

    experiments.track("message.sent", { value: 1, properties: { length: 120 } });

    expect(events[1]).toMatchObject({
      name: "message.sent",
      category: "experiment",
      value: 1,
      properties: { length: 120, "experiment.chat-tone": first.variant },
    });
    expect(experiments.assignments()).toEqual({ "chat-tone": first.variant });
  });

  it("honours targeting and runs work under the assignment", async () => {
    const experiments = createExperiments({
      provider,
      context: { targetingKey: "user:9", plan: "free" },
    });

    const result = await experiments.run(tone, async (config, assignment) => ({
      system: config.system,
      variant: assignment.variant,
    }));

    expect(result).toEqual({ system: "You are helpful.", variant: "control" });
  });

  it("evaluates flags with defaults when disabled or unknown", async () => {
    const { events, telemetry } = capturingTelemetry();
    const experiments = createExperiments({ provider, context: { region: "eu" }, telemetry });

    await expect(experiments.flag(memorySynthesis)).resolves.toBe(true);
    await expect(experiments.flagDetails(memorySynthesis)).resolves.toMatchObject({
      reason: "DISABLED",
    });
    await expect(
      experiments.flag(defineFlag({ key: "unknown-flag", defaultValue: 3 })),
    ).resolves.toBe(3);
    expect(events.map((event) => event.properties?.["feature_flag.key"])).toEqual([
      "memory-synthesis",
      "unknown-flag",
    ]);
  });
});

describe("runExperiment", () => {
  it("runs every variant, scores them, picks the best and reports telemetry", async () => {
    const { events, telemetry } = capturingTelemetry();
    const order: string[] = [];
    const summary = await runExperiment({
      key: "prompt-sweep",
      variants: gridVariants({ temperature: [0.2, 0.8], prompt: ["short", "long"] }),
      concurrency: 2,
      telemetry,
      execute: async (config, context) => {
        order.push(context.variantId);

        if (config.prompt === "long" && config.temperature === 0.8) {
          throw new Error("too creative");
        }

        return { length: config.prompt.length * (1 + config.temperature) };
      },
      metric: (result) => result.length,
    });

    expect(cartesianCount({ temperature: [0.2, 0.8], prompt: ["short", "long"] })).toBe(4);
    expect(order).toHaveLength(4);
    expect(summary).toMatchObject({
      successCount: 3,
      failureCount: 1,
      best: { variantId: "temperature=0.8,prompt=short", score: 9 },
    });
    expect(summary.runs.find((run) => !run.ok)).toMatchObject({ error: "too creative" });
    expect(events.map((event) => event.name)).toEqual([
      "experiment.variant",
      "experiment.variant",
      "experiment.variant",
      "experiment.variant",
      "experiment.completed",
    ]);
    expect(events.at(-1)?.properties).toMatchObject({
      "experiment.best_variant": "temperature=0.8,prompt=short",
      "experiment.failure_count": 1,
    });
  });

  it("stops after the first failure when asked and prefers lower scores when told", async () => {
    const summary = await runExperiment({
      key: "latency",
      variants: [
        { id: "a", config: 1 },
        { id: "b", config: 2 },
        { id: "c", config: 3 },
      ],
      concurrency: 1,
      stopOnError: true,
      higherIsBetter: false,
      execute: async (config) => {
        if (config === 2) {
          throw new Error("boom");
        }

        return config;
      },
      metric: (result) => result,
    });

    expect(summary.runs.map((run) => run.variantId)).toEqual(["a", "b"]);
    expect(summary.best).toEqual({ variantId: "a", score: 1 });
  });

  it("expands a parameter grid", () => {
    expect(cartesian({ a: [1, 2], b: ["x"] })).toEqual([
      { a: 1, b: "x" },
      { a: 2, b: "x" },
    ]);
    expect(cartesian({ a: [], b: ["x"] })).toEqual([]);
  });
});
