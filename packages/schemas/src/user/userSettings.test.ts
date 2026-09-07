import { describe, expect, it } from "vitest";

import { updateUserSettingsSchema } from "./userSettings.js";

describe("updateUserSettingsSchema", () => {
  it("accepts each supported guardrail provider", () => {
    for (const provider of ["llamaguard", "bedrock", "mistral", "shieldstral"]) {
      expect(updateUserSettingsSchema.safeParse({ guardrails_provider: provider }).success).toBe(
        true,
      );
    }
  });

  it("rejects unknown guardrail providers", () => {
    expect(
      updateUserSettingsSchema.safeParse({ guardrails_provider: "untrusted-provider" }).success,
    ).toBe(false);
  });

  it("accepts account-scoped onboarding keys", () => {
    expect(
      updateUserSettingsSchema.safeParse({
        onboarding_seen: ["model-sources:web", "model-sources:desktop"],
      }).success,
    ).toBe(true);
  });

  it("rejects malformed onboarding keys", () => {
    expect(updateUserSettingsSchema.safeParse({ onboarding_seen: [1] }).success).toBe(false);
  });
});
