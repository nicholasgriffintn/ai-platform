import { describe, expect, it } from "vitest";

import { updateUserSettingsSchema } from "./userSettings.js";

describe("updateUserSettingsSchema", () => {
  it("rejects unknown guardrail providers", () => {
    expect(
      updateUserSettingsSchema.safeParse({ guardrails_provider: "untrusted-provider" }).success,
    ).toBe(false);
  });

  it("rejects malformed onboarding keys", () => {
    expect(updateUserSettingsSchema.safeParse({ onboarding_seen: [1] }).success).toBe(false);
  });
});
