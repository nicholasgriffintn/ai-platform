import { readFile } from "node:fs/promises";

import { embeddingEvaluationDatasetSchema } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { WORKERS_EMBEDDING_MODEL } from "~/config/storage";

import {
  embeddingDatasetDigest,
  scoreEmbeddingCapture,
} from "../../../scripts/lib/embedding-evaluation.mjs";
import { captureWorkersEmbeddingBaseline } from "../../../scripts/lib/workers-embedding-evaluation.mjs";

const dataset = {
  id: "regression",
  passages: { a: "Relevant", b: "Partly relevant", c: "Distractor" },
  queries: {
    one: { category: "code", content: "Find relevant", relevance: { a: 3, b: 1 } },
    two: { category: "text", content: "Find other", relevance: { c: 3 } },
  },
};

const capture = () => ({
  datasetSha256: embeddingDatasetDigest(dataset),
  provider: "workers-ai",
  model: WORKERS_EMBEDDING_MODEL,
  dimensions: 2,
  distanceMetric: "cosine",
  taskMode: "symmetric",
  vectorSpaceVersion: "v1",
  capturedAt: "2026-10-04T12:00:00Z",
  transport: "direct-api",
  cache: "unknown",
  costUsd: null,
  documentDurationMs: 50,
  passages: { a: [1, 0], b: [0.8, 0.6], c: [0, 1] },
  queries: {
    one: [{ values: [1, 0], durationMs: 10 }],
    two: [{ values: [1, 0], durationMs: 90 }],
  },
});

describe("embedding provider comparison", () => {
  it("scores partial recall, missing results and graded relevance with measured latency", () => {
    const report = scoreEmbeddingCapture(dataset, capture(), 1);

    expect(report.quality).toEqual({ recall: 0.25, mrr: 0.5, ndcg: 0.5 });
    expect(report.categories.code).toEqual({ recall: 0.5, mrr: 1, ndcg: 1 });
    expect(report.categories.text).toEqual({ recall: 0, mrr: 0, ndcg: 0 });
    expect(report.queryLatencyMs).toEqual({ samples: 2, p50: 10, p95: 90 });
    expect(report.costUsd).toBeNull();

    const graded = capture();

    graded.queries.one[0].values = [0.8, 0.6];
    const result = scoreEmbeddingCapture(dataset, graded, 2).queries[0]!;

    expect(result.mrr).toBe(1);
    expect(result.recall).toBe(1);
    expect(result.ndcg).toBeCloseTo((1 + 7 / Math.log2(3)) / (7 + 1 / Math.log2(3)));
  });

  it("rejects stale, incomplete and dimensionally incompatible captures", () => {
    expect(() => scoreEmbeddingCapture({ ...dataset, id: "changed" }, capture())).toThrow(
      "different dataset",
    );
    expect(() => scoreEmbeddingCapture(dataset, { ...capture(), passages: { a: [1, 0] } })).toThrow(
      "exactly",
    );
    expect(() => scoreEmbeddingCapture(dataset, { ...capture(), dimensions: 3 })).toThrow(
      "dimensions",
    );
    expect(() =>
      scoreEmbeddingCapture(dataset, {
        ...capture(),
        passages: { ...capture().passages, a: [0, 0] },
      }),
    ).toThrow("zero norm");
    expect(() =>
      scoreEmbeddingCapture(dataset, { ...capture(), queries: { one: capture().queries.one } }),
    ).toThrow("exactly");
    expect(() =>
      scoreEmbeddingCapture(dataset, {
        ...capture(),
        queries: {
          ...capture().queries,
          one: [...capture().queries.one, ...capture().queries.one],
        },
      }),
    ).toThrow("same number");
    expect(() => scoreEmbeddingCapture(dataset, capture(), 0)).toThrow("cutoff");
    expect(() =>
      embeddingEvaluationDatasetSchema.parse({
        ...dataset,
        queries: { one: { ...dataset.queries.one, relevance: { missing: 3 } } },
      }),
    ).toThrow("Unknown relevant passage");
  });

  it("captures the current BGE protocol with separate document and repeated query measurements", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({ success: true, result: { data: [Array(1024).fill(0.1)] } }),
          ),
      );
    const result = await captureWorkersEmbeddingBaseline(dataset, {
      accountId: "a".repeat(32),
      apiToken: "test-only-credential",
      repetitions: 2,
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(7);
    expect(fetcher.mock.calls[0][0]).toContain(WORKERS_EMBEDDING_MODEL);
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      body: JSON.stringify({ text: [dataset.passages.a] }),
      redirect: "error",
    });
    expect(fetcher.mock.calls[3][1]).toMatchObject({
      body: JSON.stringify({ text: [dataset.queries.one.content] }),
    });
    expect(result.queries.one).toHaveLength(2);
    expect(scoreEmbeddingCapture(dataset, result).provenance.model).toBe(WORKERS_EMBEDDING_MODEL);
    expect(JSON.stringify(result)).not.toContain("test-only-credential");
  });

  it("stops on rate limiting without exposing provider response bodies or credentials", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("private-provider-sentinel", { status: 429 }));

    await expect(
      captureWorkersEmbeddingBaseline(dataset, {
        accountId: "a".repeat(32),
        apiToken: "test-only-credential",
        fetcher,
      }),
    ).rejects.toMatchObject({
      message: "Workers AI baseline failed (HTTP 429); no comparison was produced",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(captureWorkersEmbeddingBaseline(dataset)).rejects.toThrow("Set CLOUDFLARE");
  });

  it("rejects malformed responses and transport failures without including their payloads", async () => {
    const options = { accountId: "a".repeat(32), apiToken: "test-only-credential" };
    const invalidJson = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("private-provider-sentinel"));
    const networkFailure = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("private-provider-sentinel"));
    const wrongDimensions = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, result: { data: [[0.1, 0.2]] } })),
      );

    await expect(
      captureWorkersEmbeddingBaseline(dataset, { ...options, fetcher: invalidJson }),
    ).rejects.toMatchObject({
      message: "Workers AI baseline returned invalid JSON; no comparison was produced",
    });
    await expect(
      captureWorkersEmbeddingBaseline(dataset, { ...options, fetcher: networkFailure }),
    ).rejects.toMatchObject({
      message: "Workers AI baseline request failed or timed out; no comparison was produced",
    });
    await expect(
      captureWorkersEmbeddingBaseline(dataset, { ...options, fetcher: wrongDimensions }),
    ).rejects.toThrow("1,024-dimensional");
  });

  it("validates the representative corpus and rejects edited relevance labels", async () => {
    const corpus = JSON.parse(
      await readFile(
        new URL("../../../evaluations/embeddings/polychat-retrieval-v1.json", import.meta.url),
        "utf8",
      ),
    );

    embeddingEvaluationDatasetSchema.parse(corpus);
    const changed = { ...corpus, passages: {} };

    expect(() => embeddingEvaluationDatasetSchema.parse(changed)).toThrow(
      "Unknown relevant passage",
    );
  });
});
