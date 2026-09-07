// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { apiKeyService } from "../api-key.js";

describe("apiKeyService", () => {
  beforeEach(() => {
    window.localStorage.clear();
    apiKeyService.removeApiKey();
  });

  it("keeps the access token for the life of the page and no longer", async () => {
    await apiKeyService.setApiKey("a".repeat(40));

    expect(await apiKeyService.getApiKey()).toBe("a".repeat(40));

    apiKeyService.removeApiKey();

    expect(await apiKeyService.getApiKey()).toBeNull();
  });

  it("never writes the token to storage a later page load could read", async () => {
    await apiKeyService.setApiKey("b".repeat(40));

    expect(window.localStorage.length).toBe(0);
  });

  it("discards a token an earlier release left in storage", async () => {
    window.localStorage.setItem("api_key", "left-behind");
    window.localStorage.setItem("encrypted_api_key", '{"iv":[],"encrypted":[]}');

    expect(await apiKeyService.getApiKey()).toBeNull();
    expect(window.localStorage.getItem("api_key")).toBeNull();
    expect(window.localStorage.getItem("encrypted_api_key")).toBeNull();
  });

  it("refuses a token that is too short or has unexpected characters", () => {
    expect(apiKeyService.validateApiKey("c".repeat(40))).toBe(true);
    expect(apiKeyService.validateApiKey("short")).toBe(false);
    expect(apiKeyService.validateApiKey(`${"c".repeat(39)} `)).toBe(false);
  });
});
