import { describe, expect, it, vi } from "vitest";

import { HuggingFaceHubClient, isModelSourceError } from "../index.js";

const SHA = "7ae557604adf67be50417f59c2c2f167def9a775";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);

  headers.set("content-type", "application/json");

  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

describe("HuggingFaceHubClient", () => {
  it("pins a branch to its commit and normalises repo metadata", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        id: "Qwen/Qwen2.5-0.5B-Instruct",
        sha: SHA,
        gated: "manual",
        cardData: { license: "apache-2.0", base_model: "Qwen/Qwen2.5-0.5B" },
        config: { architectures: ["Qwen2ForCausalLM"] },
        safetensors: { total: 494032768 },
        inferenceProviderMapping: {
          "featherless-ai": { status: "live", providerId: "Qwen/Qwen2.5-0.5B-Instruct" },
        },
      }),
    );
    const client = new HuggingFaceHubClient({ fetcher, token: "hf_test" });

    const info = await client.getRepoInfo({
      kind: "model",
      repo: "Qwen/Qwen2.5-0.5B-Instruct",
      revision: "main",
    });

    expect(info).toMatchObject({
      sha: SHA,
      gated: true,
      licence: "apache-2.0",
      baseModels: ["Qwen/Qwen2.5-0.5B"],
      parameterCount: 494032768,
      inferenceProviders: [
        {
          provider: "featherless-ai",
          providerModelId: "Qwen/Qwen2.5-0.5B-Instruct",
          status: "live",
        },
      ],
    });

    const [url, init] = fetcher.mock.calls[0];

    expect(String(url)).toContain("/api/models/Qwen/Qwen2.5-0.5B-Instruct/revision/main?");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer hf_test" });
  });

  it("follows tree pagination and keeps lfs hashes and scanner findings", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          [
            {
              type: "file",
              path: "pytorch_model.bin",
              size: 134,
              lfs: { oid: "a".repeat(64), size: 5_000_000 },
              securityFileStatus: {
                status: "unsafe",
                pickleImportScan: {
                  status: "unsafe",
                  pickleImports: [{ module: "os", name: "system", safety: "dangerous" }],
                },
                protectAiScan: { status: "unsafe", message: "Arbitrary code execution" },
              },
            },
            { type: "directory", path: "nested" },
          ],
          {
            headers: {
              link: '<https://huggingface.co/api/models/a/b/tree/x?cursor=2>; rel="next"',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse([{ type: "file", path: "nested/config.json", size: 12 }]),
      );
    const client = new HuggingFaceHubClient({ fetcher });

    const files = await client.listFiles({ kind: "model", repo: "a/b", revision: SHA });

    expect(files).toEqual([
      {
        path: "pytorch_model.bin",
        size: 5_000_000,
        sha256: "a".repeat(64),
        scanStatus: "unsafe",
        scanFindings: [
          "pickleImportScan: unsafe",
          "protectAiScan: unsafe (Arbitrary code execution)",
        ],
        pickleImports: [{ module: "os", name: "system", safety: "dangerous" }],
      },
      {
        path: "nested/config.json",
        size: 12,
        sha256: null,
        scanStatus: "unknown",
        scanFindings: [],
        pickleImports: [],
      },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects repository and revision strings that would escape the API path", async () => {
    const fetcher = vi.fn();
    const client = new HuggingFaceHubClient({ fetcher });

    await expect(
      client.getRepoInfo({ kind: "model", repo: "../../api/whoami", revision: "main" }),
    ).rejects.toSatisfy((error) => isModelSourceError(error, "invalid_reference"));
    await expect(
      client.listFiles({ kind: "model", repo: "a/b", revision: "../../settings" }),
    ).rejects.toSatisfy((error) => isModelSourceError(error, "invalid_reference"));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("asks the datasets API only for fields it accepts and surfaces the Hub's error", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse({ error: "Invalid option at expand[2]" }, { status: 400 }),
    );
    const client = new HuggingFaceHubClient({ fetcher });

    await expect(client.search({ kind: "dataset", query: "wikipedia", limit: 5 })).rejects.toThrow(
      "Searching datasets failed with status 400: Invalid option at expand[2]",
    );

    const url = new URL(String(fetcher.mock.calls[0][0]));

    expect(url.pathname).toBe("/api/datasets");
    expect(url.searchParams.getAll("expand[]")).not.toContain("pipeline_tag");
  });

  it("maps gated access failures to an unauthorised error", async () => {
    const client = new HuggingFaceHubClient({
      fetcher: vi.fn(async () => new Response("", { status: 403 })),
    });

    await expect(
      client.getRepoInfo({ kind: "model", repo: "meta-llama/Llama-3.1-8B", revision: "main" }),
    ).rejects.toSatisfy((error) => isModelSourceError(error, "unauthorised"));
  });
});
