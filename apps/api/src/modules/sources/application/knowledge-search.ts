import type {
  ProjectKnowledgeSearchQuery,
  ProjectKnowledgeSearchResponse,
} from "@ngriffin_uk/polychat-schemas";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";
import { fuseRankedResults, toFtsQuery } from "@ngriffin_uk/polychat-utility-server/search-ranking";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { getEmbeddingRuntimeForTarget } from "~/infrastructure/providers/capabilities/embedding/helpers";
import { decodeEmbeddingRuntimeTarget } from "~/infrastructure/providers/capabilities/embedding/target";
import {
  getPersonalEmbeddingScopeTag,
  getProjectEmbeddingScopeTag,
} from "~/infrastructure/providers/capabilities/embedding/utils/scope";
import { queryEmbeddingRuntime } from "~/modules/apps/application/embeddings/provider-query";
import { rerankAuthorisedDocuments } from "~/modules/functions/application/document-reranking";
import type {
  KnowledgeScope,
  SourceSearchPassage,
} from "~/modules/sources/infrastructure/SourceSearchRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

export async function requireKnowledgeScope(
  context: ServiceContext,
  projectId?: string,
): Promise<KnowledgeScope> {
  if (projectId) {
    await requireProjectAccess(context, projectId);
  }

  return { userId: context.requireUser().id, projectId };
}

async function semanticTargetPassages(
  context: ServiceContext,
  input: ProjectKnowledgeSearchQuery,
  scope: KnowledgeScope,
  scopeTag: string,
  { target, userId }: { target: string; userId: number },
): Promise<SourceSearchPassage[]> {
  try {
    const owner = await context.repositories.users.getUserById(userId);

    if (!owner) {
      return [];
    }

    const settings = await createServiceContext({
      env: context.env,
      user: owner,
    }).getUserSettings();

    if (!settings) {
      return [];
    }

    const decodedTarget = decodeEmbeddingRuntimeTarget(target);
    const runtime = getEmbeddingRuntimeForTarget(context.env, owner, settings, decodedTarget);
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

    const hydrated = await context.repositories.sourceSearch.hydrate(scope, ids, input.type, true);
    const byId = new Map<string, SourceSearchPassage>();

    for (const passage of hydrated) {
      if (passage.target === target && passage.userId === userId) {
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

async function semanticPassages(
  context: ServiceContext,
  input: ProjectKnowledgeSearchQuery,
  scope: KnowledgeScope,
) {
  const targets = await context.repositories.sourceSearch.getTargets(scope);

  if (targets.length > 8 || targets.length === 0) {
    return [];
  }

  let scopeTag: string;

  try {
    scopeTag = input.projectId
      ? await getProjectEmbeddingScopeTag(context.env.EMBEDDING_SCOPE_SECRET, input.projectId)
      : await getPersonalEmbeddingScopeTag(context.env.EMBEDDING_SCOPE_SECRET, scope.userId);
  } catch {
    return [];
  }

  const searchTarget = semanticTargetPassages.bind(null, context, input, scope, scopeTag);

  return mapWithConcurrency(targets, 4, searchTarget);
}

export async function searchProjectKnowledge(
  context: ServiceContext,
  input: ProjectKnowledgeSearchQuery,
): Promise<ProjectKnowledgeSearchResponse> {
  const scope = await requireKnowledgeScope(context, input.projectId);
  const fts = toFtsQuery(input.query);
  const [lexical, semantic] = await Promise.all([
    fts
      ? context.repositories.sourceSearch.lexical(scope, fts, input.type)
      : Promise.resolve<SourceSearchPassage[]>([]),
    semanticPassages(context, input, scope),
  ]);

  await requireKnowledgeScope(context, input.projectId);
  const hasSemantic = semantic.some((ranking) => ranking.length > 0);
  const candidates = fuseRankedResults([lexical, ...semantic], 30);
  const current = await context.repositories.sourceSearch.hydrate(
    scope,
    candidates.map((passage) => passage.id),
    input.type,
  );
  const currentById = new Map(current.map((passage) => [passage.id, passage]));
  const documents = candidates.flatMap((candidate) => {
    const passage = currentById.get(candidate.id);

    if (!passage) {
      return [];
    }

    return [
      {
        id: passage.sourceId,
        sourceId: passage.sourceId,
        chunkId: passage.id,
        chunkIndex: passage.chunkIndex,
        title: passage.title,
        content: passage.content,
        type: passage.type,
        score: candidate.score,
        rankingMethod: hasSemantic ? "hybrid-reciprocal-rank-fusion" : "keyword-bm25",
        provenance: {
          projectId: input.projectId ?? null,
          sourceRevision: passage.sourceRevision,
          externalUri: passage.externalUri,
          updatedAt: passage.updatedAt,
          upstreamRevision: passage.upstreamRevision,
          lastSyncedAt: passage.lastSyncedAt,
        },
      },
    ];
  });
  const ranked = await rerankAuthorisedDocuments({
    env: context.env,
    user: context.requireUser(),
    query: input.query,
    documents,
  });

  await requireKnowledgeScope(context, input.projectId);
  const authorised = await context.repositories.sourceSearch.hydrate(
    scope,
    candidates.map((passage) => passage.id),
    input.type,
  );
  const authorisedIds = new Set(authorised.map((passage) => passage.id));

  return {
    status: "success",
    data: ranked
      .filter((passage) => authorisedIds.has(passage.chunkId))
      .slice(0, input.top_k ?? 10),
  };
}
