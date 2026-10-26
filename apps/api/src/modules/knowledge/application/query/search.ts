import { authorise } from "@ngriffin_uk/polychat-library-policy";
import type {
  KnowledgeOrigin,
  ProjectKnowledgeSearchQuery,
  ProjectKnowledgeSearchResponse,
} from "@ngriffin_uk/polychat-schemas";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";
import { fuseRankedResults, toFtsQuery } from "@ngriffin_uk/polychat-utility-server/search-ranking";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getEmbeddingRuntimeForTarget } from "~/infrastructure/providers/capabilities/embedding/helpers";
import { decodeEmbeddingRuntimeTarget } from "~/infrastructure/providers/capabilities/embedding/target";
import {
  getPersonalEmbeddingScopeTag,
  getProjectEmbeddingScopeTag,
} from "~/infrastructure/providers/capabilities/embedding/utils/scope";
import { queryEmbeddingRuntime } from "~/modules/knowledge/application/index/provider-query";
import {
  searchExternalKnowledge,
  type ExternalKnowledgeHit,
} from "~/modules/knowledge/application/query/external";
import { rerankAuthorisedDocuments } from "~/modules/knowledge/application/query/reranking";
import {
  KnowledgeIndexRepository,
  type KnowledgeFilters,
  type KnowledgePassage,
  type KnowledgeScope,
} from "~/modules/knowledge/infrastructure/KnowledgeIndexRepository";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

type KnowledgeResult = ProjectKnowledgeSearchResponse["data"][number];

const DEFAULT_TOP_K = 10;

export interface KnowledgeQueryOptions {
  excludeConfidential?: boolean;
}

function readFilters(
  input: ProjectKnowledgeSearchQuery,
  options: KnowledgeQueryOptions,
): KnowledgeFilters {
  return {
    kinds: input.kinds,
    resourceTypes: input.resourceTypes,
    origins: input.origins,
    providers: input.providers,
    collectionIds: input.collectionIds,
    syncIds: input.syncIds,
    since: input.since,
    until: input.until,
    excludeConfidential: options.excludeConfidential,
  };
}

export async function requireKnowledgeScope(
  context: ServiceContext,
  projectId?: string,
  sourceIds?: readonly string[],
  filters?: KnowledgeFilters,
): Promise<KnowledgeScope> {
  if (projectId) {
    await requireProjectAccess(context, projectId);
  }

  return { userId: context.requireUser().id, projectId, sourceIds, filters };
}

async function semanticTargetPassages(
  context: ServiceContext,
  input: ProjectKnowledgeSearchQuery,
  scope: KnowledgeScope,
  scopeTag: string,
  { target, userId }: { target: string; userId: number },
): Promise<KnowledgePassage[]> {
  try {
    const owner = await context.repositories.get(UserRepository).getUserById(userId);
    const settings = owner
      ? await context.repositories.get(UserSettingsRepository).getUserSettings(owner.id)
      : null;

    if (!owner || !settings) {
      return [];
    }

    const runtime = getEmbeddingRuntimeForTarget(
      context.env,
      owner,
      settings,
      decodeEmbeddingRuntimeTarget(target),
    );
    const result = await queryEmbeddingRuntime({
      ...runtime,
      query: input.query,
      type: input.kinds?.length === 1 ? input.kinds[0] : undefined,
      scopeTag,
    });
    const matches = [...result.matches].sort((a, b) => b.score - a.score);
    const hydrated = await context.repositories.get(KnowledgeIndexRepository).hydrate(
      scope,
      matches.map((match) => match.id),
      true,
    );
    const byId = new Map(
      hydrated
        .filter((passage) => passage.target === target && passage.userId === userId)
        .map((passage) => [passage.id, passage]),
    );

    return matches.flatMap((match) => {
      const passage = byId.get(match.id);

      return passage ? [passage] : [];
    });
  } catch {
    return [];
  }
}

async function semanticPassages(
  context: ServiceContext,
  input: ProjectKnowledgeSearchQuery,
  scope: KnowledgeScope,
): Promise<KnowledgePassage[][]> {
  const targets = await context.repositories.get(KnowledgeIndexRepository).getTargets(scope);

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

  return mapWithConcurrency(targets, 4, (target) =>
    semanticTargetPassages(context, input, scope, scopeTag, target),
  );
}

function toResult(
  passage: KnowledgePassage,
  score: number,
  rankingMethod: string,
  projectId: string | null,
): KnowledgeResult {
  return {
    id: passage.sourceId,
    sourceId: passage.sourceId,
    chunkId: passage.id,
    chunkIndex: passage.chunkIndex,
    resultType: passage.resourceType,
    title: passage.title,
    content: passage.content,
    type: passage.type,
    origin: (passage.origin as KnowledgeOrigin | null) ?? null,
    provider: passage.provider,
    score,
    rankingMethod,
    provenance: {
      projectId,
      sourceRevision: passage.sourceRevision,
      externalUri: passage.externalUri,
      updatedAt: passage.updatedAt,
      upstreamRevision: passage.upstreamRevision,
      lastSyncedAt: passage.lastSyncedAt,
    },
  };
}

function toExternalResult(hit: ExternalKnowledgeHit, projectId: string | null): KnowledgeResult {
  const id = `ext_${hit.provider}_${hit.id}`;

  return {
    id,
    sourceId: id,
    chunkId: id,
    chunkIndex: 0,
    resultType: "external",
    title: hit.title,
    content: hit.content,
    type: "external",
    origin: null,
    provider: hit.provider,
    score: hit.score,
    rankingMethod: "external",
    provenance: {
      projectId,
      sourceRevision: 1,
      externalUri: hit.url,
      updatedAt: null,
      upstreamRevision: null,
      lastSyncedAt: null,
    },
  };
}

export async function searchProjectKnowledge(
  context: ServiceContext,
  input: ProjectKnowledgeSearchQuery,
  options: KnowledgeQueryOptions = {},
): Promise<ProjectKnowledgeSearchResponse> {
  const filters = readFilters(input, options);
  const scope = await requireKnowledgeScope(context, input.projectId, input.sourceIds, filters);
  const topK = input.top_k ?? DEFAULT_TOP_K;
  const index = context.repositories.get(KnowledgeIndexRepository);
  const fts = toFtsQuery(input.query);
  const wantsExternal = input.includeExternal === true && !input.sourceIds;
  const [lexical, semantic, external] = await Promise.all([
    fts ? index.lexical(scope, fts) : Promise.resolve<KnowledgePassage[]>([]),
    semanticPassages(context, input, scope),
    wantsExternal
      ? searchExternalKnowledge(
          context,
          { userId: scope.userId, projectId: input.projectId ?? null },
          input.query,
          topK,
        )
      : Promise.resolve(null),
  ]);

  await requireKnowledgeScope(context, input.projectId);
  const hasSemantic = semantic.some((ranking) => ranking.length > 0);
  const candidates = fuseRankedResults([lexical, ...semantic], 30);
  const current = new Map(
    (
      await index.hydrate(
        scope,
        candidates.map((passage) => passage.id),
      )
    ).map((passage) => [passage.id, passage]),
  );
  const projectId = input.projectId ?? null;
  const teammate = options.excludeConfidential === true;
  const local = candidates.flatMap((candidate) => {
    const passage = current.get(candidate.id);

    return passage &&
      authorise("knowledge.retrieve", {
        retrieval: passage.retrieval,
        sensitivity: passage.sensitivity,
        teammate,
      }).allowed
      ? [
          toResult(
            passage,
            candidate.score,
            hasSemantic ? "hybrid-reciprocal-rank-fusion" : "keyword-bm25",
            projectId,
          ),
        ]
      : [];
  });
  const documents = [
    ...local,
    ...(external?.hits.map((hit) => toExternalResult(hit, projectId)) ?? []),
  ];
  const ranked = await rerankAuthorisedDocuments({
    env: context.env,
    user: context.requireUser(),
    query: input.query,
    documents,
  });

  await requireKnowledgeScope(context, input.projectId);
  const authorised = new Set(
    (
      await index.hydrate(
        scope,
        candidates.map((passage) => passage.id),
      )
    ).map((passage) => passage.id),
  );

  return {
    status: "success",
    data: ranked
      .filter((result) => result.resultType === "external" || authorised.has(result.chunkId))
      .slice(0, topK),
    ...(external ? { external: external.outcomes } : {}),
  };
}
