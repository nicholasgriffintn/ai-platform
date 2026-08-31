import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import {
  getEmbeddingRuntimeForTarget,
  getEmbeddingRuntimeTargetKey,
  type EmbeddingRuntimeTarget,
} from "~/lib/providers/capabilities/embedding/helpers";
import { getPersonalEmbeddingScopeTag } from "~/lib/providers/capabilities/embedding/utils/scope";
import type {
  ActiveEmbeddingChunk,
  EmbeddingDocumentProviderTarget,
} from "~/repositories/EmbeddingRepository";
import type { IEnv, IUser } from "~/types";
import { mapWithConcurrency } from "~/utils/async";
import { AssistantError, ErrorType } from "~/utils/errors";

import { queryEmbeddingRuntime } from "./provider-query";
import { parseQueryEmbeddingsRequest } from "./requests";

const PROVIDER_QUERY_CONCURRENCY = 4;
const MAX_QUERY_RESULTS = 15;
const MAX_PROVIDER_TARGETS = 8;
const RECIPROCAL_RANK_OFFSET = 60;

interface QueryEmbeddingsRequest {
  request: unknown;
  context?: ServiceContext;
  env?: IEnv;
  user?: IUser;
}

type TargetedMatch = {
  id: string;
  score: number;
  target: EmbeddingDocumentProviderTarget;
};

const toRuntimeTarget = (target: EmbeddingDocumentProviderTarget): EmbeddingRuntimeTarget => ({
  embeddingProvider: target.provider,
  providerTarget: target.providerTarget,
  model: target.embeddingModel,
  dimensions: target.embeddingDimensions,
  distanceMetric: target.distanceMetric,
  taskMode: target.taskMode,
  vectorSpace: target.vectorSpace,
  vectorSpaceVersion: target.vectorSpaceVersion,
});

const targetKey = (target: EmbeddingDocumentProviderTarget) =>
  getEmbeddingRuntimeTargetKey(toRuntimeTarget(target));

const recordMatchesTarget = (
  record: ActiveEmbeddingChunk,
  target: EmbeddingDocumentProviderTarget,
) =>
  record.provider === target.provider &&
  record.providerTarget === target.providerTarget &&
  record.embeddingModel === target.embeddingModel &&
  record.embeddingDimensions === target.embeddingDimensions &&
  record.distanceMetric === target.distanceMetric &&
  record.taskMode === target.taskMode &&
  record.vectorSpace === target.vectorSpace &&
  record.vectorSpaceVersion === target.vectorSpaceVersion;

const queryStoredTargets = async (
  serviceContext: ServiceContext,
  authenticatedUser: IUser,
  input: ReturnType<typeof parseQueryEmbeddingsRequest>,
) => {
  const userSettings = await serviceContext.getUserSettings();

  if (!userSettings) {
    throw new AssistantError("User settings not found", ErrorType.NOT_FOUND, 404);
  }

  const storedTargets = await serviceContext.repositories.embeddings.getActiveProviderTargets(
    authenticatedUser.id,
    MAX_PROVIDER_TARGETS + 1,
  );

  if (storedTargets.length === 0) {
    return { status: "success", data: [] };
  }

  if (storedTargets.length > MAX_PROVIDER_TARGETS) {
    throw new AssistantError(
      "Embedding targets require consolidation before search",
      ErrorType.CONFIGURATION_ERROR,
      409,
    );
  }

  const scopeTag = await getPersonalEmbeddingScopeTag(
    serviceContext.env.EMBEDDING_SCOPE_SECRET,
    authenticatedUser.id,
  );
  const providerResults = await mapWithConcurrency(
    storedTargets,
    PROVIDER_QUERY_CONCURRENCY,
    async (storedTarget) => {
      try {
        const runtime = getEmbeddingRuntimeForTarget(
          serviceContext.env,
          authenticatedUser,
          userSettings,
          toRuntimeTarget(storedTarget),
        );

        const result = await queryEmbeddingRuntime({
          embedder: runtime.embedder,
          vectorStore: runtime.vectorStore,
          query: input.query,
          type: input.type,
          scopeTag,
        });

        return { matches: result.matches, target: storedTarget };
      } catch {
        return null;
      }
    },
  );
  const successfulProviderResults = providerResults.filter((result) => result !== null);

  if (successfulProviderResults.length === 0) {
    throw new AssistantError(
      "No embedding target is currently searchable",
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  const matchesByTargetAndVectorId = new Map<string, TargetedMatch>();
  const useRankFusion = successfulProviderResults.length > 1;
  const rankingMethod = useRankFusion ? "reciprocal-rank-fusion" : "provider-score";

  for (const { matches, target } of successfulProviderResults) {
    // ES2022 Workers do not expose Array#toSorted, and this copied array is safe to mutate.
    // oxlint-disable-next-line unicorn/no-array-sort
    const rankedTargetMatches = [...matches].sort((left, right) => right.score - left.score);

    for (const [rank, match] of rankedTargetMatches.entries()) {
      const key = `${targetKey(target)}:${match.id}`;
      const existing = matchesByTargetAndVectorId.get(key);
      const score = useRankFusion ? 1 / (RECIPROCAL_RANK_OFFSET + rank + 1) : match.score;

      if (!existing || score > existing.score) {
        matchesByTargetAndVectorId.set(key, { id: match.id, score, target });
      }
    }
  }

  // ES2022 Workers do not expose Array#toSorted, and this copied array is safe to mutate.
  // oxlint-disable-next-line unicorn/no-array-sort
  const matches = [...matchesByTargetAndVectorId.values()].sort(
    (left, right) => right.score - left.score,
  );

  if (matches.length === 0) {
    return { status: "success", data: [] };
  }

  const records = await serviceContext.repositories.embeddings.getActiveChunksByVectorIds(
    authenticatedUser.id,
    matches.map((match) => match.id),
    input.type,
  );

  const recordsByVectorId = new Map(records.map((record) => [record.vectorId, record]));

  return {
    status: "success",
    data: matches
      .map((match) => {
        const record = recordsByVectorId.get(match.id);

        if (!record || !recordMatchesTarget(record, match.target)) {
          return null;
        }

        return {
          id: record.logicalId,
          chunkId: record.chunkId,
          chunkIndex: record.chunkIndex,
          title: record.title,
          content: record.content,
          metadata: record.metadata,
          score: match.score,
          rankingMethod,
          provenance: {
            embeddingProvider: record.provider,
            model: record.embeddingModel,
            dimensions: record.embeddingDimensions,
            distanceMetric: record.distanceMetric,
            taskMode: record.taskMode,
            vectorSpaceVersion: record.vectorSpaceVersion,
          },
          type: record.type,
        };
      })
      .filter((record) => record !== null)
      .slice(0, MAX_QUERY_RESULTS),
  };
};

export const queryEmbeddings = async ({ request, context, env, user }: QueryEmbeddingsRequest) => {
  const serviceContext = resolveServiceContext({ context, env, user });
  const authenticatedUser = serviceContext.requireUser();
  const input = parseQueryEmbeddingsRequest(request);

  try {
    return await queryStoredTargets(serviceContext, authenticatedUser, input);
  } catch (error) {
    if (
      error instanceof AssistantError &&
      [ErrorType.CONFIGURATION_ERROR, ErrorType.NOT_FOUND].includes(error.type)
    ) {
      throw error;
    }

    throw new AssistantError("Unable to search embedding documents", ErrorType.PROVIDER_ERROR, 502);
  }
};
