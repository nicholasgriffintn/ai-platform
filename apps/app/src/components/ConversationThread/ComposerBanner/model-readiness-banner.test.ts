import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { buildModelReadinessBanner } from "./model-readiness-banner";

const now = new Date("2026-09-05T10:00:30.000Z");

function model(overrides: Partial<ModelConfigItem> = {}): ModelConfigItem {
  return {
    id: "test-model",
    matchingModel: "test-model",
    provider: "test",
    isExecutable: true,
    ...overrides,
  };
}

describe("buildModelReadinessBanner", () => {
  it("explains a removed account selection without substituting it", () => {
    expect(buildModelReadinessBanner("removed-model", undefined, false, now)).toMatchObject({
      tone: "critical",
      message: expect.stringContaining("not replaced automatically"),
    });
  });

  it("distinguishes stale and unknown readiness from a known failure", () => {
    const readiness = {
      protocolVersion: 1 as const,
      state: "unknown" as const,
      reasonCode: "check_failed" as const,
      reason: "The provider check failed.",
      checkedAt: "2026-09-05T10:00:00.000Z",
      expiresAt: "2026-09-05T10:01:00.000Z",
    };

    expect(buildModelReadinessBanner("test-model", model({ readiness }), false, now)).toMatchObject(
      {
        tone: "warning",
        title: "Model readiness is unknown",
      },
    );
    expect(
      buildModelReadinessBanner(
        "test-model",
        model({ readiness }),
        false,
        new Date("2026-09-05T10:01:00.000Z"),
      ),
    ).toMatchObject({ title: "Model readiness needs refreshing" });
  });
});
