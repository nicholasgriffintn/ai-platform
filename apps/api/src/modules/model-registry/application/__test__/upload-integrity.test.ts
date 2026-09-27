import { HuggingFaceHubClient } from "@ngriffin_uk/polychat-ai-model-providers";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { describe, expect, it, vi } from "vitest";

import type { StoredUploadFile } from "../../infrastructure/ModelUploadRepository";
import { verifyPublishedUpload } from "../upload-integrity";

const file: StoredUploadFile = {
  path: "config.json",
  key: "upload/config.json",
  size: 2,
  multipartId: "multipart",
  index: 0,
  partCount: 1,
  partsUploaded: [],
  etags: {},
  sha256: null,
};

it("verifies regular Git files by reading their bytes when the Hub has no SHA256", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(JSON.stringify([{ type: "file", path: file.path, size: 2 }])),
    )
    .mockResolvedValueOnce(new Response("{}"));
  const client = new HuggingFaceHubClient({ fetcher });

  await expect(
    verifyPublishedUpload(client, "org/model", "revision", [
      { ...file, sha256: await sha256Hex("{}") },
    ]),
  ).resolves.toEqual({ missing: [], mismatched: [] });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(String(fetcher.mock.calls[1]?.[0])).toContain("/resolve/revision/config.json");
});

describe("incomplete publications", () => {
  it("reports missing files and corrupt regular files instead of passing integrity", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ type: "file", path: file.path, size: 2 }])),
      )
      .mockResolvedValueOnce(new Response("[]"));
    const client = new HuggingFaceHubClient({ fetcher });

    await expect(
      verifyPublishedUpload(client, "org/model", "revision", [
        { ...file, sha256: await sha256Hex("{}") },
        { ...file, path: "weights.safetensors", sha256: "a".repeat(64) },
      ]),
    ).resolves.toEqual({ missing: ["weights.safetensors"], mismatched: ["config.json"] });
  });

  it("checks LFS hashes without downloading model weights", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify([
            { type: "file", path: file.path, size: 2, lfs: { oid: "a".repeat(64), size: 2 } },
          ]),
        ),
      );
    const client = new HuggingFaceHubClient({ fetcher });

    await expect(
      verifyPublishedUpload(client, "org/model", "revision", [{ ...file, sha256: "b".repeat(64) }]),
    ).resolves.toEqual({ missing: [], mismatched: ["config.json"] });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
