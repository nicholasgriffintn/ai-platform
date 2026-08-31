import type { ServiceContext } from "~/lib/context/serviceContext";
import {
  EMBEDDING_VECTOR_SPACE_VERSION,
  WORKERS_EMBEDDING_MODEL,
} from "~/lib/providers/capabilities/embedding/constants";
import {
  getEmbeddingProvider,
  getEmbeddingProviderForTarget,
  resolveEmbeddingProviderTarget,
  type EmbeddingProviderTarget,
} from "~/lib/providers/capabilities/embedding/helpers";
import {
  getPersonalEmbeddingScopeTag,
  getProjectEmbeddingScopeTag,
} from "~/lib/providers/capabilities/embedding/utils/scope";
import type { SourceRecord } from "~/repositories/SourceRepository";
import type { EmbeddingProvider, IEnv, IUser, IUserSettings, MemoryScope } from "~/types";
import { mapWithConcurrency } from "~/utils/async";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { parseJsonRecord } from "~/utils/json";
import { getLogger } from "~/utils/logger";

import { BaseMemoryProvider } from "../base";
import type {
  MemoryProviderCapabilities,
  MemoryRetrieveOptions,
  MemoryRetrieveResult,
  MemoryStoreInput,
  MemoryStoreResult,
} from "../types";

const logger = getLogger({ prefix: "lib/providers/memory/built-in" });
const TARGET_QUERY_CONCURRENCY = 3;
const MAX_MEMORY_PROVIDER_TARGETS = 8;
const MEMORY_MATCH_HYDRATION_CONCURRENCY = 8;
const RECIPROCAL_RANK_OFFSET = 60;
const DEFAULT_VECTORIZE_TARGET: EmbeddingProviderTarget = {
  provider: "vectorize",
  target: "vectorize-binding",
  model: WORKERS_EMBEDDING_MODEL,
  vectorSpace: "default",
  vectorSpaceVersion: EMBEDDING_VECTOR_SPACE_VERSION,
};

interface TargetedMemory {
  memory: SourceRecord;
  target: EmbeddingProviderTarget;
  vectorId: string;
}

interface HydratedMemoryMatch {
  memory: SourceRecord;
  score: number;
}

export class BuiltInMemoryProvider extends BaseMemoryProvider {
  readonly name = "built-in" as const;
  readonly capabilities: MemoryProviderCapabilities = {
    deduplication: true,
    reasoning: false,
    conversationIngestion: false,
    externalStorage: false,
    deletion: true,
  };

  constructor(
    env: IEnv,
    user?: IUser,
    userSettings?: IUserSettings | null,
    serviceContext?: ServiceContext,
    memoryScope?: MemoryScope,
  ) {
    super({ env, user, userSettings, serviceContext, memoryScope });
  }

  async storeMemory(input: MemoryStoreInput): Promise<MemoryStoreResult> {
    if (!this.user?.id) {
      throw new AssistantError(
        "User ID is required for built-in memory",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const providerSettings = input.userSettings ?? this.userSettings ?? undefined;
    const currentTarget = await this.resolveCurrentTarget(providerSettings);
    const embedding = this.getProviderForTarget(currentTarget, providerSettings);
    const vectorId = generateId();
    const vectors = await embedding.generate("memory", input.text, vectorId, {
      type: "memory",
    });

    if (!vectors[0]?.values) {
      throw this.providerError();
    }

    const activeMemories = await this.listActiveTargetedMemories();
    const existing = await this.queryTargets({
      query: input.text,
      targetedMemories: activeMemories,
      currentTarget,
      providerSettings,
      topK: 5,
      scoreThreshold: 0.85,
      currentProvider: embedding,
      currentVector: new Float64Array(vectors[0].values),
    });

    if (existing.length > 0) {
      return { id: null, provider: this.name };
    }

    const id = await this.createLocalMemory(input, vectorId, currentTarget, "processing");

    if (!id) {
      throw new AssistantError("Failed to create memory", ErrorType.DATABASE_ERROR);
    }

    try {
      const inserted = await embedding.insert(vectors, {
        scopeTag: await this.getScopeTag(),
        contentType: "memory",
      });

      if (inserted.status !== "success") {
        throw this.providerError();
      }
    } catch {
      if (await this.compensateProviderVector(embedding, vectorId)) {
        try {
          await this.removeLocalMemory(id);
        } catch {
          // A processing source remains invisible and records the incomplete write for repair.
        }
      }

      throw this.providerError();
    }

    try {
      const activated = await this.transitionLocalMemoryStatus(id, ["processing"], "available");

      if (!activated) {
        throw new AssistantError("Memory lifecycle changed", ErrorType.CONFLICT_ERROR, 409);
      }
    } catch {
      let lifecycleStatus: string | null | undefined;

      try {
        lifecycleStatus = (await this.getLocalMemoryForDelete(id))?.memory.status ?? null;
      } catch {
        lifecycleStatus = undefined;
      }

      if (lifecycleStatus === "available") {
        return { id, provider: this.name, externalId: vectorId };
      }

      if (
        lifecycleStatus !== undefined &&
        lifecycleStatus !== "available" &&
        (await this.compensateProviderVector(embedding, vectorId))
      ) {
        try {
          await this.removeLocalMemory(id);
        } catch {
          // A processing source remains invisible and can be repaired safely.
        }
      }

      throw new AssistantError("Unable to confirm memory activation", ErrorType.DATABASE_ERROR);
    }

    return { id, provider: this.name, externalId: vectorId };
  }

  async retrieveMemories(
    query: string,
    options: MemoryRetrieveOptions = {},
  ): Promise<MemoryRetrieveResult[]> {
    if (!this.user?.id) {
      throw new AssistantError(
        "User ID is required for built-in memory",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const providerSettings = options.userSettings ?? this.userSettings ?? undefined;
    const topK = options.topK ?? 3;
    const scoreThreshold = options.scoreThreshold ?? 0.3;
    const activeMemories = await this.listActiveTargetedMemories();

    if (activeMemories.length === 0) {
      return [];
    }

    const matches = await this.queryTargets({
      query,
      targetedMemories: activeMemories,
      providerSettings,
      topK: Math.max(topK * 2, 10),
      scoreThreshold,
    });
    const bestByMemory = new Map<string, HydratedMemoryMatch>();

    for (const match of matches) {
      const existing = bestByMemory.get(match.memory.id);

      if (!existing || match.score > existing.score) {
        bestByMemory.set(match.memory.id, match);
      }
    }

    // ES2022 Workers do not expose Array#toSorted, and this copied array is safe to mutate.
    // oxlint-disable-next-line unicorn/no-array-sort
    const rankedMemories = [...bestByMemory.values()].sort(
      (left, right) => right.score - left.score,
    );

    return rankedMemories.slice(0, topK).map(({ memory, score }) => {
      const metadata = parseJsonRecord(memory.metadata);

      delete metadata.embedding_provider_target;

      return {
        id: memory.id,
        text: memory.content ?? "",
        score,
        metadata,
      };
    });
  }

  async deleteMemory(memoryId: string): Promise<boolean> {
    if (!this.user?.id) {
      throw new AssistantError(
        "User ID is required to delete memories",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    try {
      const localMemory = await this.getLocalMemoryForDelete(memoryId);

      if (!localMemory) {
        logger.warn("Memory not found or access denied");

        return false;
      }

      const providerSettings = this.userSettings ?? undefined;
      const storedTarget = this.getLocalMemoryEmbeddingTarget(localMemory.memory);

      if (!storedTarget) {
        logger.warn("Legacy memory is missing immutable embedding target provenance");
        await this.transitionLocalMemoryStatus(
          memoryId,
          ["processing", "available", "archived"],
          "archived",
        );

        return false;
      }

      const archived = await this.transitionLocalMemoryStatus(
        memoryId,
        ["processing", "available", "archived"],
        "archived",
      );

      if (!archived) {
        const current = await this.getLocalMemoryForDelete(memoryId);

        if (!current) {
          return true;
        }

        if (current.memory.status !== "archived") {
          return false;
        }
      }

      if (localMemory.vectorId) {
        const embedding = this.getProviderForTarget(storedTarget, providerSettings);
        const deleted = await embedding.delete([localMemory.vectorId]);

        if (deleted.status !== "success") {
          return false;
        }
      }

      await this.removeLocalMemory(memoryId);

      return true;
    } catch {
      logger.error("Failed to delete memory");

      return false;
    }
  }

  private async listActiveTargetedMemories(): Promise<TargetedMemory[]> {
    const memories = await this.listActiveScopedLocalMemories();
    const targeted: TargetedMemory[] = [];

    for (const memory of memories) {
      const vectorId = this.getLocalMemoryVectorId(memory);
      const target = this.getLocalMemoryEmbeddingTarget(memory);

      if (!vectorId || !target) {
        continue;
      }

      targeted.push({
        memory,
        target,
        vectorId,
      });
    }

    return targeted;
  }

  private async queryTargets(input: {
    query: string;
    targetedMemories: TargetedMemory[];
    currentTarget?: EmbeddingProviderTarget;
    providerSettings?: IUserSettings;
    topK: number;
    scoreThreshold: number;
    currentProvider?: EmbeddingProvider;
    currentVector?: Float64Array;
  }): Promise<HydratedMemoryMatch[]> {
    const targetGroups = new Map<
      string,
      { target: EmbeddingProviderTarget; memoriesByVectorId: Map<string, SourceRecord> }
    >();

    for (const entry of input.targetedMemories) {
      const key = this.targetKey(entry.target);
      const group = targetGroups.get(key) ?? {
        target: entry.target,
        memoriesByVectorId: new Map<string, SourceRecord>(),
      };

      group.memoriesByVectorId.set(entry.vectorId, entry.memory);
      targetGroups.set(key, group);
    }

    if (targetGroups.size > MAX_MEMORY_PROVIDER_TARGETS) {
      throw new AssistantError(
        "Memory embedding targets require consolidation before search",
        ErrorType.CONFIGURATION_ERROR,
        409,
      );
    }

    const scopeTag = await this.getScopeTag();
    const useRankFusion = targetGroups.size > 1;
    const results = await mapWithConcurrency(
      [...targetGroups.values()],
      TARGET_QUERY_CONCURRENCY,
      async ({ target, memoriesByVectorId }) => {
        try {
          const isCurrentTarget =
            input.currentTarget !== undefined && this.targetsEqual(target, input.currentTarget);
          const embedding =
            isCurrentTarget && input.currentProvider
              ? input.currentProvider
              : this.getProviderForTarget(target, input.providerSettings);
          let vector = isCurrentTarget ? input.currentVector : undefined;

          if (!vector) {
            const queryEmbedding = await embedding.getQuery(input.query);
            const values = queryEmbedding.data?.[0];

            if (
              queryEmbedding.status.success !== true ||
              !Array.isArray(values) ||
              values.length === 0 ||
              values.some((value) => typeof value !== "number" || !Number.isFinite(value))
            ) {
              throw this.providerError();
            }

            vector = new Float64Array(values);
          }

          const matches = await embedding.getMatches(vector, {
            topK: input.topK,
            scoreThreshold: input.scoreThreshold,
            scopeTag,
            contentType: "memory",
            returnMetadata: "none",
          });

          // ES2022 Workers do not expose Array#toSorted, and this copied array is safe to mutate.
          const candidates = [...matches.matches]
            // oxlint-disable-next-line unicorn/no-array-sort
            .sort((left, right) => right.score - left.score)
            .filter(
              (match) => match.score >= input.scoreThreshold && memoriesByVectorId.has(match.id),
            );
          const hydrated = await mapWithConcurrency(
            candidates,
            MEMORY_MATCH_HYDRATION_CONCURRENCY,
            async (match, rank) => {
              const memory = await this.getScopedLocalMemoryByVectorId(match.id);
              const storedTarget = memory ? this.getLocalMemoryEmbeddingTarget(memory) : null;

              return memory?.content && storedTarget && this.targetsEqual(storedTarget, target)
                ? {
                    memory,
                    score: useRankFusion ? 1 / (RECIPROCAL_RANK_OFFSET + rank + 1) : match.score,
                  }
                : null;
            },
          );

          return hydrated.filter((match) => match !== null);
        } catch {
          return null;
        }
      },
    );
    const successfulResults = results.filter((result) => result !== null);

    if (successfulResults.length === 0 && targetGroups.size > 0) {
      throw this.providerError();
    }

    return successfulResults.flat();
  }

  private async resolveCurrentTarget(
    userSettings?: IUserSettings,
  ): Promise<EmbeddingProviderTarget> {
    if (this.memoryScope.type === "project" || !userSettings) {
      return DEFAULT_VECTORIZE_TARGET;
    }

    if (!this.user) {
      throw new AssistantError(
        "User is required to resolve the embedding target",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    return resolveEmbeddingProviderTarget(this.env, this.user, userSettings);
  }

  private getProviderForTarget(
    target: EmbeddingProviderTarget,
    userSettings?: IUserSettings,
  ): EmbeddingProvider {
    if (userSettings && this.user) {
      return getEmbeddingProviderForTarget(this.env, this.user, userSettings, target);
    }

    if (this.targetsEqual(target, DEFAULT_VECTORIZE_TARGET)) {
      return getEmbeddingProvider(this.env, this.user);
    }

    throw new AssistantError(
      "Stored memory embedding target is unavailable",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  private async getScopeTag(): Promise<string> {
    if (this.memoryScope.type === "project") {
      return getProjectEmbeddingScopeTag(
        this.env.EMBEDDING_SCOPE_SECRET,
        this.memoryScope.projectId,
      );
    }

    if (!this.user?.id) {
      throw new AssistantError(
        "User ID is required for built-in memory",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    return getPersonalEmbeddingScopeTag(this.env.EMBEDDING_SCOPE_SECRET, this.user.id);
  }

  private async compensateProviderVector(
    embedding: EmbeddingProvider,
    vectorId: string,
  ): Promise<boolean> {
    try {
      const cleanup = await embedding.delete([vectorId]);

      return cleanup.status === "success";
    } catch {
      return false;
    }
  }

  private targetKey(target: EmbeddingProviderTarget): string {
    return JSON.stringify([
      target.provider,
      target.target,
      target.model,
      target.vectorSpace,
      target.vectorSpaceVersion,
    ]);
  }

  private targetsEqual(left: EmbeddingProviderTarget, right: EmbeddingProviderTarget): boolean {
    return this.targetKey(left) === this.targetKey(right);
  }

  private providerError(): AssistantError {
    return new AssistantError("Unable to access memory embeddings", ErrorType.PROVIDER_ERROR, 502);
  }
}
