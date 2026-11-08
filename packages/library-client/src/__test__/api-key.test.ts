// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { apiKeyService } from "../api-key.js";

describe("apiKeyService", () => {
  beforeEach(() => {
    window.localStorage.clear();
    apiKeyService.removeApiKey();
  });

  it("never writes the token to storage a later page load could read", async () => {
    await apiKeyService.setApiKey("b".repeat(40));

    expect(window.localStorage.length).toBe(0);
  });
});
