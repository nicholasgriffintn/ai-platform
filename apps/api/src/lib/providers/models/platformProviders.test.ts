import { describe, expect, it } from "vitest";

import { isProviderPlatformEnabled } from "./platformProviders";

describe("isProviderPlatformEnabled", () => {
  it("enables a provider when its API key is set", () => {
    expect(isProviderPlatformEnabled("openai", { OPENAI_API_KEY: "sk-test" })).toBe(true);
  });

  it("disables a provider when its API key is missing or blank", () => {
    expect(isProviderPlatformEnabled("openai", {})).toBe(false);
    expect(isProviderPlatformEnabled("openai", { OPENAI_API_KEY: "  " })).toBe(false);
  });

  it("requires both Bedrock AWS keys", () => {
    expect(
      isProviderPlatformEnabled("bedrock", {
        BEDROCK_AWS_ACCESS_KEY: "ak",
        BEDROCK_AWS_SECRET_KEY: "sk",
      }),
    ).toBe(true);
    expect(isProviderPlatformEnabled("bedrock", { BEDROCK_AWS_ACCESS_KEY: "ak" })).toBe(false);
  });

  it("accepts either Polly credential pair", () => {
    expect(
      isProviderPlatformEnabled("polly", {
        POLLY_ACCESS_KEY_ID: "ak",
        POLLY_SECRET_ACCESS_KEY: "sk",
      }),
    ).toBe(true);
    expect(
      isProviderPlatformEnabled("polly", {
        BEDROCK_AWS_ACCESS_KEY: "ak",
        BEDROCK_AWS_SECRET_KEY: "sk",
      }),
    ).toBe(true);
    expect(isProviderPlatformEnabled("polly", { POLLY_ACCESS_KEY_ID: "ak" })).toBe(false);
  });

  it("keeps keyless platform providers always enabled", () => {
    expect(isProviderPlatformEnabled("workers-ai", {})).toBe(true);
    expect(isProviderPlatformEnabled("workers", {})).toBe(true);
  });

  it("disables unknown providers", () => {
    expect(isProviderPlatformEnabled("does-not-exist", { OPENAI_API_KEY: "sk-test" })).toBe(false);
  });
});
