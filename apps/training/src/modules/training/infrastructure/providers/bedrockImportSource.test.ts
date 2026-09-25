import type { TrainingModelDefinition } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { stageBedrockImportSource } from "./bedrockImportSource.js";

const BUCKET = "https://bedrock-imports.s3.us-east-1.amazonaws.com";
const SHA = "5c1d2e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d";

const MODEL: TrainingModelDefinition = {
  id: "lizzy-7b",
  provider: "aws-sagemaker",
  family: "huggingface",
  name: "Lizzy 7B",
  baseModel: "flwrlabs/Lizzy-7B",
  defaultHyperparameters: {},
};

describe("stageBedrockImportSource", () => {
  it("refuses to stage a revision the Hub scan marks unsafe", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "flwrlabs/Lizzy-7B", sha: SHA }))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            type: "file",
            path: "pytorch_model.bin",
            size: 134,
            securityFileStatus: { status: "unsafe" },
          },
        ]),
      );

    await expect(
      stageBedrockImportSource({
        env: {
          AWS_ACCESS_KEY_ID: "access-key",
          AWS_SECRET_ACCESS_KEY: "secret-key",
          BEDROCK_IMPORT_BUCKET: "bedrock-imports",
        },
        model: MODEL,
        fetcher: fetchMock,
      }),
    ).rejects.toThrow(/pytorch_model\.bin unsafe/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("copies missing files for the pinned commit to the Bedrock import bucket", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const events: string[] = [];

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "flwrlabs/Lizzy-7B", sha: SHA }))
      .mockResolvedValueOnce(
        jsonResponse([
          { type: "file", path: "config.json", size: 100 },
          {
            type: "file",
            path: "model.safetensors",
            size: 134,
            lfs: { oid: "b".repeat(64), size: 200 },
            securityFileStatus: { status: "safe" },
          },
          { type: "file", path: ".gitattributes", size: 10 },
        ]),
      )
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(
        new Response("{}", { headers: { "content-type": "application/json" } }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const s3Uri = await stageBedrockImportSource({
      env: {
        AWS_REGION: "us-east-1",
        AWS_ACCESS_KEY_ID: "access-key",
        AWS_SECRET_ACCESS_KEY: "secret-key",
        BEDROCK_IMPORT_BUCKET: "bedrock-imports",
      },
      model: MODEL,
      fetcher: fetchMock,
      onEvent: (event) => {
        events.push(event.message);
      },
    });

    expect(s3Uri).toBe(`s3://bedrock-imports/models/flwrlabs-Lizzy-7B/${SHA}/`);
    expect(events).toEqual([
      "Hugging Face model staging started",
      "Hugging Face model staging completed",
    ]);
    expect(
      fetchMock.mock.calls.map(([input, init]) => [String(input), init?.method || "GET"]),
    ).toEqual([
      [expect.stringContaining("/api/models/flwrlabs/Lizzy-7B/revision/main?"), "GET"],
      [
        `https://huggingface.co/api/models/flwrlabs/Lizzy-7B/tree/${SHA}?recursive=true&expand=true`,
        "GET",
      ],
      [`${BUCKET}/models/flwrlabs-Lizzy-7B/${SHA}/config.json`, "HEAD"],
      [`https://huggingface.co/flwrlabs/Lizzy-7B/resolve/${SHA}/config.json`, "GET"],
      [`${BUCKET}/models/flwrlabs-Lizzy-7B/${SHA}/config.json`, "PUT"],
      [`${BUCKET}/models/flwrlabs-Lizzy-7B/${SHA}/model.safetensors`, "HEAD"],
    ]);
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}
