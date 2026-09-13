import { describe, expect, it } from "vitest";

import { createPolychatClient } from "./http.js";

function createClient(captured: { url: string; init: RequestInit }[]) {
  return createPolychatClient({
    baseUrl: "https://api.polychat.app",
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      captured.push({ url: String(input), init: init ?? {} });

      return new Response("{}", { status: 200 });
    },
    getHeaders: async () => ({
      Authorization: "Bearer token",
      "X-Device-Id": "device-1",
      "Content-Type": "application/json",
    }),
  });
}

describe("polychat client preflight hygiene", () => {
  it("strips Content-Type and the device header from bodyless GETs", async () => {
    const captured: { url: string; init: RequestInit }[] = [];
    const client = createClient(captured);

    await client.fetch("/models", { method: "GET" });

    const headers = new Headers(captured[0].init.headers);

    expect(headers.has("Content-Type")).toBe(false);
    expect(headers.has("X-Device-Id")).toBe(false);
    expect(headers.get("Authorization")).toBe("Bearer token");
  });

  it("keeps Content-Type and the device header on POSTs with a body", async () => {
    const captured: { url: string; init: RequestInit }[] = [];
    const client = createClient(captured);

    await client.fetch("/sync/grant", { method: "POST", body: { deviceId: "device-1" } });

    const headers = new Headers(captured[0].init.headers);

    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-Device-Id")).toBe("device-1");
  });

  it("never forces Content-Type when there is no body, even if pre-set upstream", async () => {
    const captured: { url: string; init: RequestInit }[] = [];
    const client = createPolychatClient({
      baseUrl: "https://api.polychat.app",
      fetch: async (input: string | URL | Request, init?: RequestInit) => {
        captured.push({ url: String(input), init: init ?? {} });

        return new Response("{}", { status: 200 });
      },
      getHeaders: async () => ({}),
    });

    await client.fetch("/chat/completions?limit=30", { method: "GET" });

    expect(new Headers(captured[0].init.headers).has("Content-Type")).toBe(false);
  });
});
