import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { fuseRankedResults, toFtsQuery } from "@ngriffin_uk/polychat-utility-server/search-ranking";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getEmbeddingRuntimeForTarget } from "~/infrastructure/providers/capabilities/embedding/helpers";
import { decodeEmbeddingRuntimeTarget } from "~/infrastructure/providers/capabilities/embedding/target";
import { getProjectEmbeddingScopeTag } from "~/infrastructure/providers/capabilities/embedding/utils/scope";
import { queryEmbeddingRuntime } from "~/modules/apps/application/embeddings/provider-query";
import type { SourceSearchPassage } from "~/modules/sources/infrastructure/SourceSearchRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

async function semanticPassages(
  context: ServiceContext,
  projectId: string,
  query: string,
  type?: string,
) {
  const targets = await context.repositories.sourceSearch.getTargets(projectId);

  if (targets.length > 8) {
    throw new AssistantError(
      "Project knowledge targets require consolidation",
      ErrorType.CONFIGURATION_ERROR,
      409,
    );
  }

  if (targets.length === 0) {
    return [];
  }

  const settings = await context.getUserSettings();

  if (!settings) {
    return [];
  }

  let scopeTag: string;

  try {
    scopeTag = await getProjectEmbeddingScopeTag(context.env.EMBEDDING_SCOPE_SECRET, projectId);
  } catch {
    return [];
  }

  return mapWithConcurrency(targets, 4, async ({ target }) => {
    try {
      const runtime = getEmbeddingRuntimeForTarget(
        context.env,
        context.requireUser(),
        settings,
        decodeEmbeddingRuntimeTarget(target),
      );
      const result = await queryEmbeddingRuntime({ ...runtime, query, type, scopeTag });
      const matches = [...result.matches].sort((a, b) => b.score - a.score);
      const hydrated = await context.repositories.sourceSearch.hydrate(
        projectId,
        matches.map((match) => match.id),
        type,
      );
      const byId = new Map(
        hydrated
          .filter((passage) => passage.target === target)
          .map((passage) => [passage.id, passage]),
      );

      return matches.flatMap((match) => {
        const passage = byId.get(match.id);

        return passage ? [passage] : [];
      });
    } catch {
      return [];
    }
  });
}

export async function searchProjectKnowledge(
  context: ServiceContext,
  input: { projectId: string; query: string; type?: string; top_k?: number },
) {
  await requireProjectAccess(context, input.projectId);
  const fts = toFtsQuery(input.query);
  const [lexical, semantic] = await Promise.all([
    fts
      ? context.repositories.sourceSearch.lexical(input.projectId, fts, input.type)
      : Promise.resolve<SourceSearchPassage[]>([]),
    semanticPassages(context, input.projectId, input.query, input.type),
  ]);

  await requireProjectAccess(context, input.projectId);
  const hasSemantic = semantic.some((ranking) => ranking.length > 0);
  const documents = fuseRankedResults([lexical, ...semantic], input.top_k ?? 15).map((passage) => ({
    id: passage.sourceId,
    sourceId: passage.sourceId,
    chunkId: passage.id,
    chunkIndex: passage.chunkIndex,
    title: passage.title,
    content: passage.content,
    type: passage.type,
    score: passage.score,
    rankingMethod: hasSemantic ? "hybrid-reciprocal-rank-fusion" : "keyword-bm25",
    provenance: {
      projectId: input.projectId,
      sourceRevision: passage.sourceRevision,
      externalUri: passage.externalUri,
      updatedAt: passage.updatedAt,
      upstreamRevision: passage.upstreamRevision,
      lastSyncedAt: passage.lastSyncedAt,
    },
  }));

  return { status: "success", data: documents };
}
