import { defineExperiment } from "@ngriffin_uk/polychat-ai-experiments";
import type { FlagshipBinding } from "@ngriffin_uk/polychat-library-flags";
import { describe, expect, it, vi } from "vitest";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { buildFlagBootstrap } from "~/modules/experiments/application/bootstrap";
import type { IEnv, IUser } from "~/types";

import { evaluateServerFlag, experimentsFor, taskFlags } from "../index";

const user = { id: 42, email: "nick@example.com", plan_id: "pro" } as IUser;

function fakeFlags(overrides: Partial<FlagshipBinding> = {}): FlagshipBinding {
  const notFound = async <T>(flagKey: string, defaultValue: T) => ({
    flagKey,
    value: defaultValue,
    reason: "DEFAULT",
    errorCode: "FLAG_NOT_FOUND",
  });

  return {
    get: async (_flagKey, defaultValue) => defaultValue,
    getBooleanDetails: notFound,
    getStringDetails: notFound,
    getNumberDetails: notFound,
    getObjectDetails: notFound,
    ...overrides,
  };
}

const tone = defineExperiment({
  key: "chat-tone",
  variants: { control: { system: "plain" }, playful: { system: "witty" } },
  control: "control",
});

describe("experimentsFor", () => {
  it("buckets on the analytics distinct id and records assignments on the context", async () => {
    const context = createServiceContext({ env: {} as IEnv, user });
    const experiments = experimentsFor(context);

    const assignment = await experiments.assign(tone);
    const again = await experimentsFor(context).assign(tone);

    expect(experiments.context).toMatchObject({
      targetingKey: "user:42",
      plan: "pro",
      authenticated: true,
    });
    expect(assignment.variant).toBe(again.variant);
    expect(context.experimentAssignments).toEqual({ "chat-tone": assignment.variant });
    expect(experimentsFor(context)).toBe(experiments);
  });

  it("falls back to the control without a user or anonymous id", async () => {
    const experiments = experimentsFor(createServiceContext({ env: {} as IEnv }));

    await expect(experiments.assign(tone)).resolves.toMatchObject({
      variant: "control",
      reason: "DEFAULT",
    });
  });
});

describe("task flags", () => {
  it("defaults from the environment toggles and lets Flagship override them", async () => {
    const env = { MEMORY_SYNTHESIS_ENABLED: "true" } as IEnv;

    await expect(evaluateServerFlag(env, taskFlags(env).memory_synthesis)).resolves.toBe(true);
    await expect(evaluateServerFlag(env, taskFlags(env).training_quality_scoring)).resolves.toBe(
      false,
    );

    const getBooleanDetails = vi.fn(async (flagKey: string) => ({
      flagKey,
      value: false,
      variant: "off",
      reason: "TARGETING_MATCH",
    }));
    const flagged = { ...env, FLAGS: fakeFlags({ getBooleanDetails }) } as IEnv;

    await expect(evaluateServerFlag(flagged, taskFlags(flagged).memory_synthesis)).resolves.toBe(
      false,
    );
    expect(getBooleanDetails).toHaveBeenCalledWith("memory_synthesis", true, {
      targetingKey: "server",
    });
  });
});

describe("buildFlagBootstrap", () => {
  it("evaluates every registered definition for the caller", async () => {
    const env = { TRAINING_QUALITY_SCORING_ENABLED: "true" } as IEnv;
    const bootstrap = await buildFlagBootstrap(createServiceContext({ env, user }));

    expect(bootstrap.targetingKey).toBe("user:42");
    expect(bootstrap.evaluations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ flagKey: "memory_synthesis", value: false, reason: "STATIC" }),
        expect.objectContaining({
          flagKey: "training_quality_scoring",
          value: true,
          reason: "STATIC",
        }),
      ]),
    );
  });
});
