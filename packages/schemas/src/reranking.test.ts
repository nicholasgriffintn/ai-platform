import { describe, expect, it } from "vitest";

import { rerankingRequestSchema, rerankingResultsMatchRequest } from "./reranking.js";

describe("reranking schemas", () => {
  it("rejects duplicate IDs and topK beyond the candidate set", () => {
    expect(
      rerankingRequestSchema.safeParse({
        query: "bird",
        documents: [
          { id: "same", text: "parrot" },
          { id: "same", text: "pigeon" },
        ],
        topK: 3,
      }).success,
    ).toBe(false);
  });

  it("rejects candidate payloads beyond the aggregate byte limit", () => {
    expect(
      rerankingRequestSchema.safeParse({
        query: "bird",
        documents: Array.from({ length: 17 }, (_, index) => ({
          id: index,
          text: "x".repeat(32_768),
        })),
      }).success,
    ).toBe(false);
  });
});

describe("rerankingResultsMatchRequest", () => {
  const request = {
    documents: [
      { id: "1", text: "string ID" },
      { id: 1, text: "numeric ID" },
      { id: "third", text: "third" },
    ],
    topK: 2,
  };

  it("accepts the requested number of unique known IDs", () => {
    expect(
      rerankingResultsMatchRequest(request, [
        { id: 1, score: 0.9 },
        { id: "1", score: 0.8 },
      ]),
    ).toBe(true);
  });

  it.each([
    {
      name: "missing",
      results: [{ id: 1, score: 0.9 }],
    },
    {
      name: "duplicate",
      results: [
        { id: 1, score: 0.9 },
        { id: 1, score: 0.8 },
      ],
    },
    {
      name: "foreign",
      results: [
        { id: 1, score: 0.9 },
        { id: "foreign", score: 0.8 },
      ],
    },
  ])("rejects $name result sets", ({ results }) => {
    expect(rerankingResultsMatchRequest(request, results)).toBe(false);
  });
});
