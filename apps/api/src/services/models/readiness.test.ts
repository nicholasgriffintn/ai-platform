import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import type { IEnv } from "~/types";

import { listModels } from ".";
import { resolveModelReadiness } from "./readiness";

const now = new Date("2026-09-05T10:00:00.000Z");

function model(overrides: Partial<ModelConfigItem> = {}): ModelConfigItem {
  return {
    matchingModel: "test-model",
    provider: "test-provider",
    isFree: false,
    isPlatformEnabled: false,
    isByokEnabled: false,
    isExecutable: false,
    ...overrides,
  };
}

describe("resolveModelReadiness", () => {
  it("attaches readiness to every model returned by the existing catalogue", async () => {
    const env: IEnv = Object.create(null);

    env.ALWAYS_ENABLED_PROVIDERS = "workers-ai";
    const models = await listModels(env);

    expect(Object.keys(models).length).toBeGreaterThan(0);
    expect(Object.values(models).every((entry) => entry.readiness)).toBe(true);
  });

  it("reports current executable policy with a bounded freshness window", () => {
    expect(
      resolveModelReadiness(model({ isExecutable: true }), { id: 7, plan_id: "pro" }, now),
    ).toMatchObject({
      state: "ready",
      reasonCode: "ready",
      checkedAt: "2026-09-05T10:00:00.000Z",
      expiresAt: "2026-09-05T10:01:00.000Z",
    });
  });

  it("gives credential setup without treating it as unknown", () => {
    expect(resolveModelReadiness(model(), { id: 7, plan_id: "pro" }, now)).toMatchObject({
      state: "setup_required",
      reasonCode: "credential_required",
      action: { kind: "configure_provider", path: "/profile?tab=providers" },
    });
  });

  it("keeps an indeterminate policy check distinct from a denial", () => {
    expect(
      resolveModelReadiness(
        model({ isPlatformEnabled: undefined, isByokEnabled: undefined }),
        { id: 7, plan_id: "pro" },
        now,
      ),
    ).toMatchObject({ state: "unknown", reasonCode: "check_failed", action: { kind: "retry" } });
  });
});
