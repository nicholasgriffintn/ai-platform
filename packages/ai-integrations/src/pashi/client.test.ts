import { describe, expect, it, vi } from "vitest";

import { PashiClient } from "./client.js";

function clientFor(origin: string | undefined) {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () => new Response(JSON.stringify({ name: "Pashi", tools: [] })),
  );

  return { client: new PashiClient({ apiKey: "key", fetch, origin }), fetch };
}

describe("PashiClient origin", () => {
  it("reads the catalogue from a configured local Pashi", async () => {
    const { client, fetch } = clientFor("http://localhost:5173/");

    await client.getInfo();

    expect(String(fetch.mock.calls[0]?.[0])).toBe("http://localhost:5173/api/info");
  });

  it("uses pashi.app when no origin is configured", async () => {
    const { client, fetch } = clientFor(undefined);

    await client.getInfo();

    expect(String(fetch.mock.calls[0]?.[0])).toBe("https://pashi.app/api/info");
  });
});
