import { describe, expect, it } from "vitest";

import { updateUserSettingsSchema } from "./userSettings";

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
});
