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
import type { IUserSettings } from "~/types";

interface KnowledgeSearchInput {
  projectId: string;
  query: string;
  type?: string;
  top_k?: number;
}

async function semanticTargetPassages(
  context: ServiceContext,
  input: KnowledgeSearchInput,
  settings: IUserSettings,
  scopeTag: string,
  { target }: { target: string },
): Promise<SourceSearchPassage[]> {
  try {
    const decodedTarget = decodeEmbeddingRuntimeTarget(target);
    const runtime = getEmbeddingRuntimeForTarget(
      context.env,
      context.requireUser(),
      settings,
      decodedTarget,
    );
    const result = await queryEmbeddingRuntime({
      ...runtime,
      query: input.query,
      type: input.type,
      scopeTag,
    });
    const matches = [...result.matches].sort((a, b) => b.score - a.score);
    const ids: string[] = [];

    for (const match of matches) {
      ids.push(match.id);
    }

    const hydrated = await context.repositories.sourceSearch.hydrate(
      input.projectId,
      ids,
      input.type,
    );
    const byId = new Map<string, SourceSearchPassage>();

    for (const passage of hydrated) {
      if (passage.target === target) {
        byId.set(passage.id, passage);
      }
    }

    const passages: SourceSearchPassage[] = [];

    for (const match of matches) {
      const passage = byId.get(match.id);

      if (passage) {
        passages.push(passage);
      }
    }

    return passages;
  } catch {
    return [];
  }
}

async function semanticPassages(context: ServiceContext, input: KnowledgeSearchInput) {
  const targets = await context.repositories.sourceSearch.getTargets(input.projectId);

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
    scopeTag = await getProjectEmbeddingScopeTag(
      context.env.EMBEDDING_SCOPE_SECRET,
      input.projectId,
    );
  } catch {
    return [];
  }

  const searchTarget = semanticTargetPassages.bind(null, context, input, settings, scopeTag);

  return mapWithConcurrency(targets, 4, searchTarget);
}

export async function searchProjectKnowledge(context: ServiceContext, input: KnowledgeSearchInput) {
  await requireProjectAccess(context, input.projectId);
  const fts = toFtsQuery(input.query);
  const [lexical, semantic] = await Promise.all([
    fts
      ? context.repositories.sourceSearch.lexical(input.projectId, fts, input.type)
      : Promise.resolve<SourceSearchPassage[]>([]),
    semanticPassages(context, input),
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
