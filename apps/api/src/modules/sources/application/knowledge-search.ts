import type {
  KnowledgePassage,
  KnowledgeSearchInput,
  KnowledgeSearchResponse,
} from "@ngriffin_uk/polychat-schemas";
import { fuseRankedMatches } from "@ngriffin_uk/polychat-utility-core";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  decodeEmbeddingRuntimeTarget,
  getEmbeddingRuntimeForTarget,
} from "~/infrastructure/providers/capabilities/embedding/helpers";
import {
  getPersonalEmbeddingScopeTag,
  getProjectEmbeddingScopeTag,
} from "~/infrastructure/providers/capabilities/embedding/utils/scope";
import { queryEmbeddingRuntime } from "~/modules/apps/application/embeddings/provider-query";
import { rerankAuthorisedDocuments } from "~/modules/functions/application/document-reranking";
import {
  SourceIndexRepository,
  type KnowledgeScope,
} from "~/modules/sources/infrastructure/SourceIndexRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

export async function requireKnowledgeScope(
  context: ServiceContext,
  projectId?: string,
): Promise<KnowledgeScope> {
  const user = context.requireUser();

  if (projectId) {
    await requireProjectAccess(context, projectId);
  }

  return { userId: user.id, projectId };
}

async function searchVectors(
  context: ServiceContext,
  scope: KnowledgeScope,
  input: KnowledgeSearchInput,
) {
  const repository = new SourceIndexRepository(context.env);
  const targets = await repository.listTargets(scope);

  if (!targets.length || targets.length > 8) {
    return { rankings: [], available: false };
  }

  if (!context.env.EMBEDDING_SCOPE_SECRET) {
    return { rankings: [], available: false };
  }

  const scopeTag = scope.projectId
    ? await getProjectEmbeddingScopeTag(context.env.EMBEDDING_SCOPE_SECRET, scope.projectId)
    : await getPersonalEmbeddingScopeTag(context.env.EMBEDDING_SCOPE_SECRET, scope.userId);
  const results = await mapWithConcurrency(targets, 4, async (target) => {
    try {
      const owner = await context.repositories.users.getUserById(target.created_by_user_id);

      if (!owner) {
        return null;
      }

      const ownerContext = createServiceContext({ env: context.env, user: owner });
      const settings = await ownerContext.getUserSettings();

      if (!settings) {
        return null;
      }

      const runtime = getEmbeddingRuntimeForTarget(
        context.env,
        owner,
        settings,
        decodeEmbeddingRuntimeTarget(target.target),
      );
      const result = await queryEmbeddingRuntime({
        ...runtime,
        query: input.query,
        type: input.type,
        scopeTag,
      });

      return { matches: result.matches, target };
    } catch {
      return null;
    }
  });
  const successful = results.filter((result) => result !== null);
  const hydrated = await repository.hydrate(
    scope,
    successful.flatMap((result) => result.matches.map((match) => match.id)),
    input.type,
  );
  const byVectorId = new Map(hydrated.map((chunk) => [chunk.vector_id, chunk]));

  return {
    available: successful.length === targets.length,
    rankings: successful.map(({ matches, target }) =>
      [...matches]
        .sort((left, right) => right.score - left.score)
        .flatMap((match) => {
          const chunk = byVectorId.get(match.id);

          return chunk &&
            chunk.target === target.target &&
            chunk.created_by_user_id === target.created_by_user_id
            ? [chunk]
            : [];
        }),
    ),
  };
}

export async function searchKnowledge(
  context: ServiceContext,
  input: KnowledgeSearchInput,
): Promise<KnowledgeSearchResponse> {
  const scope = await requireKnowledgeScope(context, input.projectId);
  const repository = new SourceIndexRepository(context.env);
  const [keywords, vectors] = await Promise.all([
    repository.searchKeywords(scope, input.query, input.type),
    searchVectors(context, scope, input),
  ]);
  const candidates = fuseRankedMatches(
    [keywords, ...vectors.rankings],
    (chunk) => chunk.vector_id,
  ).slice(0, 30);

  await requireKnowledgeScope(context, input.projectId);
  const current = await repository.hydrate(
    scope,
    candidates.map(({ match }) => match.vector_id),
    input.type,
  );
  const byVectorId = new Map(current.map((chunk) => [chunk.vector_id, chunk]));
  const documents: KnowledgePassage[] = candidates.flatMap(({ match, score }) => {
    const chunk = byVectorId.get(match.vector_id);

    return chunk
      ? [
          {
            id: chunk.source_id,
            chunkId: chunk.id,
            chunkIndex: chunk.chunk_index,
            title: chunk.title,
            content: chunk.content,
            type: chunk.kind,
            score,
            rankingMethod: "reciprocal-rank-fusion",
            sourceUrl: chunk.external_uri,
            updatedAt: chunk.updated_at,
          },
        ]
      : [];
  });
  const ranked = await rerankAuthorisedDocuments({
    env: context.env,
    user: context.requireUser(),
    query: input.query,
    documents,
  });

  await requireKnowledgeScope(context, input.projectId);
  const authorised = await repository.hydrate(
    scope,
    candidates.map(({ match }) => match.vector_id),
    input.type,
  );
  const authorisedIds = new Set(authorised.map((chunk) => chunk.id));

  return {
    documents: ranked
      .filter((document) => authorisedIds.has(document.chunkId))
      .slice(0, input.topK)
      .map((document) => ({
        id: document.id,
        chunkId: document.chunkId,
        chunkIndex: document.chunkIndex,
        title: document.title,
        content: document.content,
        type: document.type,
        score: document.score,
        rankingMethod: document.rankingMethod,
        sourceUrl: document.sourceUrl,
        updatedAt: document.updatedAt,
      })),
    semanticSearchAvailable: vectors.available,
  };
}

export async function listKnowledgeStatus(context: ServiceContext, projectId?: string) {
  const scope = await requireKnowledgeScope(context, projectId);

  return { sources: await new SourceIndexRepository(context.env).listStatus(scope) };
}
