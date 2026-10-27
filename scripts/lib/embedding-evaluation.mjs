import { createHash } from "node:crypto";

import {
  embeddingEvaluationCaptureSchema,
  embeddingEvaluationDatasetSchema,
} from "../../packages/schemas/dist/index.js";
import { cosineSimilarity, percentile } from "../../packages/utility-core/dist/index.js";

export function embeddingDatasetDigest(dataset) {
  return createHash("sha256")
    .update(JSON.stringify(embeddingEvaluationDatasetSchema.parse(dataset)))
    .digest("hex");
}

function summariseRetrievalScores(scores) {
  return scores.reduce(
    (total, score) => {
      total.recall += score.recall / scores.length;
      total.mrr += score.mrr / scores.length;
      total.ndcg += score.ndcg / scores.length;

      return total;
    },
    { recall: 0, mrr: 0, ndcg: 0 },
  );
}

export function scoreEmbeddingCapture(datasetInput, captureInput, topK = 3) {
  const dataset = embeddingEvaluationDatasetSchema.parse(datasetInput);
  const capture = embeddingEvaluationCaptureSchema.parse(captureInput);

  if (!Number.isSafeInteger(topK) || topK < 1 || topK > Object.keys(dataset.passages).length) {
    throw new Error("Retrieval cutoff must fit the corpus");
  }

  if (capture.datasetSha256 !== embeddingDatasetDigest(dataset)) {
    throw new Error("Capture was generated from a different dataset");
  }

  for (const field of ["passages", "queries"]) {
    const expectedIds = Object.keys(dataset[field]).sort();
    const capturedIds = Object.keys(capture[field]).sort();

    if (JSON.stringify(expectedIds) !== JSON.stringify(capturedIds)) {
      throw new Error(`Capture must contain exactly the dataset's ${field}`);
    }
  }

  const sampleCounts = new Set(Object.values(capture.queries).map((samples) => samples.length));

  if (sampleCounts.size !== 1) {
    throw new Error("Every query must have the same number of measured samples");
  }

  const queries = Object.entries(dataset.queries).map(([id, query]) => {
    const idealGrades = Object.values(query.relevance)
      .sort((left, right) => right - left)
      .slice(0, topK);
    const idealDcg = idealGrades.reduce(
      (sum, grade, rank) => sum + (2 ** grade - 1) / Math.log2(rank + 2),
      0,
    );
    const samples = capture.queries[id].map((sample) => {
      const ranking = Object.entries(capture.passages)
        .map(([passageId, values]) => ({
          id: passageId,
          score: cosineSimilarity(sample.values, values),
        }))
        .sort(
          (left, right) =>
            right.score - left.score || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
        )
        .slice(0, topK);
      const grades = ranking.map((passage) =>
        Object.hasOwn(query.relevance, passage.id) ? query.relevance[passage.id] : 0,
      );
      const firstRelevant = grades.findIndex((grade) => grade > 0);

      return {
        recall: grades.filter((grade) => grade > 0).length / Object.keys(query.relevance).length,
        mrr: firstRelevant === -1 ? 0 : 1 / (firstRelevant + 1),
        ndcg:
          grades.reduce((sum, grade, rank) => sum + (2 ** grade - 1) / Math.log2(rank + 2), 0) /
          idealDcg,
        ranking: ranking.map((passage) => passage.id),
      };
    });

    return { id, category: query.category, ...summariseRetrievalScores(samples), samples };
  });
  const latencies = Object.values(capture.queries)
    .flat()
    .map((sample) => sample.durationMs);

  return {
    dataset: dataset.id,
    datasetSha256: capture.datasetSha256,
    provenance: {
      provider: capture.provider,
      model: capture.model,
      dimensions: capture.dimensions,
      distanceMetric: capture.distanceMetric,
      taskMode: capture.taskMode,
      vectorSpaceVersion: capture.vectorSpaceVersion,
      capturedAt: capture.capturedAt,
      transport: capture.transport,
      cache: capture.cache,
    },
    topK,
    quality: summariseRetrievalScores(queries),
    categories: Object.fromEntries(
      [...new Set(queries.map((query) => query.category))].map((category) => [
        category,
        summariseRetrievalScores(queries.filter((query) => query.category === category)),
      ]),
    ),
    queryLatencyMs: {
      samples: latencies.length,
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
    },
    documentDurationMs: capture.documentDurationMs,
    costUsd: capture.costUsd,
    queries,
  };
}
