import { describe, expect, it } from "vitest";

import { chunkKnowledgeText, parseOpenAiEmbeddingVectors } from "../embeddings.js";

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

describe("chunkKnowledgeText", () => {
  it("keeps markdown sections whole when they fit and never exceeds the limit", () => {
    const text = [
      "# One",
      "a".repeat(30),
      "## Two",
      "b".repeat(30),
      "## Three",
      "c".repeat(90),
    ].join("\n");
    const chunks = chunkKnowledgeText(text, { maxChars: 80 });

    expect(chunks[0]).toBe(`# One\n${"a".repeat(30)}\n\n## Two\n${"b".repeat(30)}`);
    expect(chunks.every((chunk) => chunk.length <= 80)).toBe(true);
    expect(chunks.join("").replace(/\s/g, "")).toBe(text.replace(/\s/g, ""));
  });

  it("splits code into blank-line blocks", () => {
    const chunks = chunkKnowledgeText("const a = 1;\n\nconst b = 2;", {
      maxChars: 14,
      format: "blocks",
    });

    expect(chunks).toEqual(["const a = 1;", "const b = 2;"]);
  });
});
