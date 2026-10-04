import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { truncateForModel } from "@ngriffin_uk/polychat-utility-core";
import { redactSensitiveUrl } from "@ngriffin_uk/polychat-utility-server/redaction";

import { ai } from "~/infrastructure/ai";
import type { IEnv, IUser } from "~/types";

const logger = getLogger({ prefix: "services/apps/retrieval/source-ranking" });

const MAX_QUERY_CHARS = 2_000;
const MAX_SOURCE_CHARS = 4_000;
const MIN_SOURCES_TO_RANK = 2;
const RELEVANCE_FLOOR = 0.15;
const MIN_SOURCES_KEPT = 3;

export interface RankableSource {
  title?: string;
  url?: string;
  content?: string;
  snippet?: string;
}

export interface SourceRankingResult<TSource extends RankableSource> {
  sources: TSource[];
  ranked: boolean;
  droppedCount: number;
}

export function sourceText(source: RankableSource): string {
  const body = source.content || source.snippet || "";
  const text = source.title ? `${source.title}\n\n${body}` : body;

  return truncateForModel(text, MAX_SOURCE_CHARS);
}

export function selectRelevantSources<TSource>(
  ranked: ReadonlyArray<{ document: TSource; score: number }>,
): { sources: TSource[]; droppedCount: number } {
  const kept = ranked.filter(
    (entry, index) => index < MIN_SOURCES_KEPT || entry.score >= RELEVANCE_FLOOR,
  );

  return {
    sources: kept.map((entry) => entry.document),
    droppedCount: ranked.length - kept.length,
  };
}

export async function rankSearchSources<TSource extends RankableSource>(params: {
  env: IEnv;
  user?: IUser;
  completionId?: string;
  query: string;
  sources: readonly TSource[];
}): Promise<SourceRankingResult<TSource>> {
  if (params.sources.length < MIN_SOURCES_TO_RANK) {
    return { sources: [...params.sources], ranked: false, droppedCount: 0 };
  }

  try {
    const result = await ai.tryRerank<TSource>({
      env: params.env,
      user: params.user,
      completion_id: params.completionId,
      query: truncateForModel(params.query, MAX_QUERY_CHARS),
      documents: params.sources,
      toText: sourceText,
      topK: params.sources.length,
    });

    if (!result) {
      return { sources: [...params.sources], ranked: false, droppedCount: 0 };
    }

    const selected = selectRelevantSources(result.results);

    logger.info("Ranked web search sources by relevance", {
      completion_id: params.completionId,
      provider: result.provider,
      model: result.model,
      kept: selected.sources.length,
      dropped: selected.droppedCount,
      topUrl: redactSensitiveUrl(selected.sources[0]?.url ?? ""),
    });

    return { sources: selected.sources, ranked: true, droppedCount: selected.droppedCount };
  } catch (error) {
    logger.warn("Source ranking failed; answering from the provider's own order", { error });

    return { sources: [...params.sources], ranked: false, droppedCount: 0 };
  }
}
