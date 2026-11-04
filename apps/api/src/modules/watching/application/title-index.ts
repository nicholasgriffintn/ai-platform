import { fetchTmdbRecentTitleIds, fetchTmdbTitle } from "@ngriffin_uk/polychat-ai-integrations";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { chunkArray } from "@ngriffin_uk/polychat-utility-core";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import { buildEmbeddingText } from "~/modules/watching/domain/title-index";
import { parseTitleId, type TitleRef } from "~/modules/watching/domain/titles";
import type { IEnv } from "~/types";

export const EMBEDDING_MODEL = "@cf/baai/bge-m3";

const logger = getLogger({ prefix: "watching/title-index" });
const VECTOR_ID_CHUNK = 20;
const REFRESH_TITLE_LIMIT = 200;
const EMBED_BATCH = 20;
const FETCH_CONCURRENCY = 6;

type TmdbTitle = Awaited<ReturnType<typeof fetchTmdbTitle>>;

async function embedTexts(env: IEnv, texts: string[]): Promise<number[][]> {
  const result = await env.AI.run(EMBEDDING_MODEL, { text: texts });

  return "data" in result && result.data ? result.data : [];
}

async function upsertTitles(
  env: IEnv,
  vectors: Vectorize,
  titles: readonly TmdbTitle[],
): Promise<number> {
  let indexed = 0;

  for (const batch of chunkArray([...titles], EMBED_BATCH)) {
    const embeddings = await embedTexts(env, batch.map(buildEmbeddingText));
    const entries = batch.flatMap((title, index) => {
      const values = embeddings[index];

      return values
        ? [
            {
              id: title.id,
              values,
              metadata: { mediaType: title.mediaType, ...(title.year ? { year: title.year } : {}) },
            },
          ]
        : [];
    });

    if (entries.length > 0) {
      await vectors.upsert(entries);
      indexed += entries.length;
    }
  }

  return indexed;
}

async function listMissingIds(vectors: Vectorize, ids: readonly string[]): Promise<string[]> {
  const found = await Promise.all(
    chunkArray([...ids], VECTOR_ID_CHUNK).map((chunk) => vectors.getByIds(chunk)),
  );
  const indexed = new Set(found.flat().map((vector) => vector.id));

  return ids.filter((id) => !indexed.has(id));
}

async function indexRefs(env: IEnv, vectors: Vectorize, token: string, refs: readonly TitleRef[]) {
  const details = await mapWithConcurrency(refs, FETCH_CONCURRENCY, (ref) =>
    fetchTmdbTitle(token, ref).catch(() => null),
  );

  return upsertTitles(
    env,
    vectors,
    details.filter((title) => title !== null),
  );
}

export async function indexTitleIfMissing(env: IEnv, titleId: string): Promise<void> {
  const vectors = env.WATCHING_VECTORS;
  const token = env.TMDB_API_TOKEN;
  const ref = parseTitleId(titleId);

  if (!vectors || !token || !ref) {
    return;
  }

  try {
    if ((await listMissingIds(vectors, [titleId])).length > 0) {
      await indexRefs(env, vectors, token, [ref]);
    }
  } catch (error) {
    logger.warn("Could not index a shelf title", {
      title_id: titleId,
      error_message: getErrorMessage(error),
    });
  }
}

export async function refreshTitleIndex(env: IEnv): Promise<void> {
  const vectors = env.WATCHING_VECTORS;
  const token = env.TMDB_API_TOKEN;

  if (!vectors || !token) {
    return;
  }

  const recent = await fetchTmdbRecentTitleIds(token);
  const missing = await listMissingIds(vectors, recent);
  const refs = missing
    .slice(0, REFRESH_TITLE_LIMIT)
    .flatMap((titleId) => parseTitleId(titleId) ?? []);
  const indexed = await indexRefs(env, vectors, token, refs);

  logger.info("Refreshed the film and TV index", {
    candidates: recent.length,
    missing: missing.length,
    indexed,
  });
}
