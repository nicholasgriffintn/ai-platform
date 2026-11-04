import { fetchTmdbTitle } from "@ngriffin_uk/polychat-ai-integrations";
import { chunkArray } from "@ngriffin_uk/polychat-utility-core";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { listRecentEntries } from "~/modules/watching/domain/shelf";
import { blendTaste, type TasteVector } from "~/modules/watching/domain/taste";
import {
  parseTitleId,
  type MediaType,
  type TitleRef,
  type TitleSummary,
} from "~/modules/watching/domain/titles";

import { requireTmdbToken, withScores } from "./catalogue";
import { readShelfContent } from "./shelf-store";
import { EMBEDDING_MODEL } from "./title-index";

const HYDRATE_CONCURRENCY = 6;
const VECTOR_QUERY_LIMIT = 50;
const TASTE_SAMPLE = 60;
const VECTOR_ID_CHUNK = 20;
const STATUS_WEIGHTS: Record<string, number> = {
  watched: 1,
  watching: 0.8,
  watchlist: 0.4,
  dropped: -0.5,
};

function requireVectors(context: ServiceContext) {
  const vectors = context.env.WATCHING_VECTORS;

  if (!vectors) {
    throw new AssistantError(
      "The title index is not configured",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  return vectors;
}

async function embedQuery(context: ServiceContext, text: string): Promise<number[]> {
  const result = await context.env.AI.run(EMBEDDING_MODEL, { text: [text] });
  const vector = "data" in result ? result.data?.[0] : undefined;

  if (!vector) {
    throw new AssistantError("Could not embed that search", ErrorType.EXTERNAL_API_ERROR, 502);
  }

  return vector;
}

async function hydrate(
  context: ServiceContext,
  refs: readonly TitleRef[],
): Promise<TitleSummary[]> {
  const token = requireTmdbToken(context);
  const titles = await mapWithConcurrency(refs, HYDRATE_CONCURRENCY, (ref) =>
    fetchTmdbTitle(token, ref).catch(() => null),
  );

  return withScores(
    context,
    titles.flatMap((title) =>
      title
        ? [
            {
              id: title.id,
              title: title.title,
              year: title.year,
              mediaType: title.mediaType,
              overview: title.overview,
              tmdbScore: title.tmdbScore,
            },
          ]
        : [],
    ),
  );
}

export async function searchByMeaning(
  context: ServiceContext,
  input: { query: string; mediaType?: MediaType; limit: number },
) {
  const matches = await requireVectors(context).query(await embedQuery(context, input.query), {
    topK: VECTOR_QUERY_LIMIT,
    returnValues: true,
  });
  const refs = matches.matches
    .flatMap((match) => parseTitleId(match.id) ?? [])
    .filter((ref) => !input.mediaType || ref.mediaType === input.mediaType)
    .slice(0, input.limit);

  return hydrate(context, refs);
}

function tasteWeight(entry: { status: string; rating?: number | null }): number {
  const base = STATUS_WEIGHTS[entry.status] ?? 0;

  return entry.rating == null ? base : base * ((entry.rating - 2.5) / 2.5);
}

async function readTasteVectors(context: ServiceContext) {
  const vectors = requireVectors(context);
  const entries = listRecentEntries(await readShelfContent(context));
  const sample = entries.slice(0, TASTE_SAMPLE);
  const found = await Promise.all(
    chunkArray(sample, VECTOR_ID_CHUNK).map((chunk) =>
      vectors.getByIds(chunk.map((entry) => entry.titleId)),
    ),
  );
  const weights = new Map(sample.map((entry) => [entry.titleId, tasteWeight(entry)]));
  const tasteVectors: TasteVector[] = found
    .flat()
    .flatMap((vector) =>
      Array.isArray(vector.values)
        ? [{ id: vector.id, values: vector.values, weight: weights.get(vector.id) ?? 0 }]
        : [],
    );

  return { entries, tasteVectors };
}

export async function recommendFromTaste(context: ServiceContext, limit: number) {
  const { entries, tasteVectors } = await readTasteVectors(context);

  if (tasteVectors.length === 0) {
    return [];
  }

  const seen = new Set(entries.map((entry) => entry.titleId));
  const matches = await requireVectors(context).query(blendTaste(tasteVectors), {
    topK: VECTOR_QUERY_LIMIT,
    returnValues: true,
  });
  const refs = matches.matches
    .filter((match) => !seen.has(match.id))
    .flatMap((match) => parseTitleId(match.id) ?? [])
    .slice(0, limit);

  return hydrate(context, refs);
}
