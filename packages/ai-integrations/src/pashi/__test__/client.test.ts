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

  describe("file converters", () => {
    const fileInfo = {
      name: "Pashi",
      tools: [
        {
          ...info.tools[0],
          endpoint: "/api/image-format",
          id: "image-format",
          input: { kind: "file", label: "Image", required: true },
          status: "available",
          toolType: "converter",
        },
      ],
    };
    const file = { blob: new Blob(["pixels"], { type: "image/png" }), name: "photo.png" };
    const job = (status: string, error = "") =>
      jsonResponse({ result: { error, jobId: "job-1", outputFormat: "webp", status } }, 200);

    function linkedClient(fetchMock: typeof fetch) {
      return new PashiClient({
        apiKey: "pashi-link",
        fetch: fetchMock,
        sleep: async () => {},
        supportsFiles: true,
      });
    }

    it("uploads, waits for the job and returns the converted file", async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(jsonResponse(fileInfo))
        .mockResolvedValueOnce(job("queued"))
        .mockResolvedValueOnce(job("processing"))
        .mockResolvedValueOnce(job("complete"))
        .mockResolvedValueOnce(
          new Response("converted", { headers: { "Content-Type": "image/webp" } }),
        );

      const result = await linkedClient(fetchMock).execute({ file, toolId: "image-format" });

      expect(await result.file?.blob.text()).toBe("converted");
      expect(result.file?.name).toBe("pashi-job-1.webp");
      expect(String(fetchMock.mock.calls[4]?.[0])).toBe(
        "https://pashi.app/api/image-format?download=job-1",
      );
    });

    it("reports a failed conversion with the reason Pashi gave", async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(jsonResponse(fileInfo))
        .mockResolvedValueOnce(job("failed", "Corrupt image."));

      await expect(
        linkedClient(fetchMock).execute({ file, toolId: "image-format" }),
      ).rejects.toThrow("Corrupt image.");
    });

    it("explains that conversion needs Pro when Pashi refuses", async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(jsonResponse(fileInfo))
        .mockResolvedValueOnce(jsonResponse({ error: "Pro only" }, 403));

      await expect(
        linkedClient(fetchMock).execute({ file, toolId: "image-format" }),
      ).rejects.toMatchObject({ code: "tool_unavailable", status: 403 });
    });

    it("refuses file tools on the shared key and when no file is given", async () => {
      const shared = new PashiClient({
        apiKey: "pashi-secret",
        fetch: vi.fn<typeof fetch>(async () => jsonResponse(fileInfo)),
      });
      const linked = linkedClient(vi.fn<typeof fetch>(async () => jsonResponse(fileInfo)));

      await expect(shared.execute({ file, toolId: "image-format" })).rejects.toMatchObject({
        code: "tool_unavailable",
      });
      await expect(linked.execute({ toolId: "image-format" })).rejects.toMatchObject({
        code: "invalid_input",
      });
    });
  });
});
