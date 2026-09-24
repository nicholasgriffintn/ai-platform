import { describe, expect, it } from "vitest";

import { parseOpenAiEmbeddingVectors } from "../embeddings.js";

describe("parseOpenAiEmbeddingVectors", () => {
  it("orders vectors by index regardless of response order", () => {
    expect(
      parseOpenAiEmbeddingVectors(
        {
          data: [
            { index: 1, embedding: [0.5, 0.6] },
            { index: 0, embedding: [0.1, 0.2] },
          ],
        },
        2,
        "bad",
      ),
    ).toEqual([
      [0.1, 0.2],
      [0.5, 0.6],
    ]);
  });

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
