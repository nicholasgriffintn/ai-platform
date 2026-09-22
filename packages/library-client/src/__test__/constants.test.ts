import { afterEach, describe, expect, it, vi } from "vitest";

describe("client endpoints", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses explicit Worker Preview endpoints", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://feature-api.example.workers.dev");
    vi.stubEnv("VITE_WS_API_URL", "wss://feature-api.example.workers.dev");

    const { API_BASE_URL, WS_API_URL } = await import("../constants.js");

    expect(API_BASE_URL).toBe("https://feature-api.example.workers.dev");
    expect(WS_API_URL).toBe("wss://feature-api.example.workers.dev");
  });
});
