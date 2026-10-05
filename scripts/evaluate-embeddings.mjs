import { readFile, writeFile } from "node:fs/promises";

import { embeddingEvaluationDatasetSchema } from "../packages/schemas/dist/index.js";
import { scoreEmbeddingCapture } from "./lib/embedding-evaluation.mjs";
import { captureWorkersEmbeddingBaseline } from "./lib/workers-embedding-evaluation.mjs";

const dataset = embeddingEvaluationDatasetSchema.parse(
  JSON.parse(
    await readFile(
      new URL("../evaluations/embeddings/polychat-retrieval-v1.json", import.meta.url),
      "utf8",
    ),
  ),
);
const [mode, ...paths] = process.argv.slice(2);

if (mode === "--baseline" && paths.length === 1) {
  const capture = await captureWorkersEmbeddingBaseline(dataset, {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
  });
  const report = scoreEmbeddingCapture(dataset, capture);

  await writeFile(paths[0], `${JSON.stringify(capture)}\n`, { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
} else if (mode && mode !== "--baseline") {
  const captures = await Promise.all(
    [mode, ...paths].map(async (path) => JSON.parse(await readFile(path, "utf8"))),
  );

  console.log(
    JSON.stringify(
      captures.map((capture) => scoreEmbeddingCapture(dataset, capture)),
      null,
      2,
    ),
  );
} else {
  throw new Error(
    "Usage: node scripts/evaluate-embeddings.mjs --baseline /tmp/bge.json OR /tmp/bge.json [/tmp/candidate.json ...]",
  );
}
