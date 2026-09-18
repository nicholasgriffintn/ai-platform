import { describe, expect, it, vi } from "vitest";

import { getPashiClient, PashiClient, PashiClientError } from "../client.js";

const info = {
  name: "Pashi",
  tools: [
    {
      aliases: ["palette"],
      audience: "designers",
      description: "Generate a colour palette",
      display: { actionLabel: "Generate", category: "design", examples: ["warm palette"] },
      endpoint: "/api/palette",
      id: "palette",
      input: { kind: "text", label: "Prompt", required: true },
      label: "Palette",
      result: { kind: "fields" },
      toolType: "generator",
    },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Pashi client", () => {
  it("refuses to build without an API key", () => {
    expect(() => new PashiClient({ apiKey: "" })).toThrowError(PashiClientError);
    expect(() => getPashiClient({})).toThrowError(/PASHI_API_KEY is required/);
  });

  it("caches the catalogue for the configured TTL and rejects malformed payloads", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(info));
    const client = new PashiClient({
      apiKey: "pashi-secret",
      fetch: fetchMock,
      now: () => 0,
      catalogTtlMs: 1_000,
    });

    await expect(client.getInfo()).resolves.toMatchObject({ name: "Pashi" });
    await expect(client.getInfo()).resolves.toMatchObject({ name: "Pashi" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] ?? [];

    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer pashi-secret");

    const invalid = new PashiClient({
      apiKey: "pashi-secret",
      fetch: vi.fn<typeof fetch>(async () => jsonResponse({ tools: [] })),
    });

    await expect(invalid.getInfo()).rejects.toMatchObject({ code: "invalid_catalog" });
  });

  it("validates operation fields before executing the tool", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(info))
      .mockResolvedValueOnce(jsonResponse({ palette: ["#fff"] }));
    const client = new PashiClient({ apiKey: "pashi-secret", fetch: fetchMock });

    await expect(
      client.execute({ toolId: "palette", fields: { unknown: "x" } }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await expect(client.execute({ toolId: "palette", input: "" })).rejects.toMatchObject({
      code: "invalid_input",
    });

    await expect(client.execute({ toolId: "palette", input: "sunset" })).resolves.toEqual({
      data: { palette: ["#fff"] },
      resultKind: "fields",
      toolId: "palette",
      toolType: "generator",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [url, init] = fetchMock.mock.calls[1] ?? [];

    expect(String(url)).toBe("https://pashi.app/api/palette");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ fields: {}, input: "sunset" });
  });

  it("surfaces upstream failures as coded errors", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(info))
      .mockResolvedValueOnce(jsonResponse({ error: "nope" }, 500));
    const client = new PashiClient({ apiKey: "pashi-secret", fetch: fetchMock });

    await expect(client.execute({ toolId: "palette", input: "sunset" })).rejects.toMatchObject({
      code: "upstream_error",
      status: 500,
    });
  });
});
