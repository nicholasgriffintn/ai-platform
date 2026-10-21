import { isRecord } from "../../packages/utility-core/dist/index.js";
import { parseEmbeddingVectors } from "../../packages/utility-server/dist/embeddings.js";
import { embeddingDatasetDigest } from "./embedding-evaluation.mjs";

export async function captureWorkersEmbeddingBaseline(
  dataset,
  { accountId = "", apiToken = "", repetitions = 5, fetcher = fetch } = {},
) {
  if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId) || !apiToken) {
    throw new Error("Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to capture the baseline");
  }

  if (!Number.isSafeInteger(repetitions) || repetitions < 1 || repetitions > 100) {
    throw new Error("Repetitions must be between 1 and 100");
  }

  const model = "@cf/baai/bge-large-en-v1.5";
  const embed = async (text) => {
    const response = await fetcher(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: [text] }),
        signal: AbortSignal.timeout(30000),
        redirect: "error",
      },
    ).catch(() => {
      throw new Error(
        "Workers AI baseline request failed or timed out; no comparison was produced",
      );
    });

    if (!response.ok) {
      throw new Error(
        `Workers AI baseline failed (HTTP ${response.status}); no comparison was produced`,
      );
    }

    const body = await response.json().catch(() => {
      throw new Error("Workers AI baseline returned invalid JSON; no comparison was produced");
    });

    if (!isRecord(body) || body.success !== true) {
      throw new Error("Workers AI baseline failed; no comparison was produced");
    }

    const vectors = parseEmbeddingVectors(body.result, "Workers AI returned invalid vectors");

    if (vectors.length !== 1 || vectors[0].length !== 1024) {
      throw new Error("Workers AI baseline must return one 1,024-dimensional vector per input");
    }

    return vectors[0];
  };

  const passages = {};
  const startedAt = performance.now();

  for (const [id, content] of Object.entries(dataset.passages)) {
    passages[id] = await embed(content);
  }

  const documentDurationMs = performance.now() - startedAt;
  const queries = Object.fromEntries(Object.keys(dataset.queries).map((id) => [id, []]));

  for (let repeat = 0; repeat < repetitions; repeat += 1) {
    for (const [id, query] of Object.entries(dataset.queries)) {
      const queryStartedAt = performance.now();
      const values = await embed(query.content);

      queries[id].push({ values, durationMs: performance.now() - queryStartedAt });
    }
  }

  return {
    datasetSha256: embeddingDatasetDigest(dataset),
    provider: "workers-ai",
    model,
    dimensions: 1024,
    distanceMetric: "cosine",
    taskMode: "symmetric",
    vectorSpaceVersion: "v1",
    capturedAt: new Date().toISOString(),
    transport: "direct-api",
    cache: "unknown",
    costUsd: null,
    documentDurationMs,
    passages,
    queries,
  };
}
