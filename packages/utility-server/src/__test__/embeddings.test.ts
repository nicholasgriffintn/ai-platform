import { describe, expect, it } from "vitest";

import { parseOpenAiEmbeddingVectors } from "../embeddings.js";

describe("parseOpenAiEmbeddingVectors", () => {
  it("rejects empty or non-numeric embeddings", () => {
    expect(() => parseOpenAiEmbeddingVectors({ data: [] }, 1, "bad")).toThrow("bad");
    expect(() =>
      parseOpenAiEmbeddingVectors({ data: [{ index: 0, embedding: ["x"] }] }, 1, "bad"),
    ).toThrow("bad");
    expect(() => parseOpenAiEmbeddingVectors({ data: "base64" }, 1, "bad")).toThrow("bad");
    expect(() =>
      parseOpenAiEmbeddingVectors(
        {
          data: [
            { index: 0, embedding: [1] },
            { index: 0, embedding: [2] },
          ],
        },
        2,
        "bad",
      ),
    ).toThrow("bad");
  });
});
