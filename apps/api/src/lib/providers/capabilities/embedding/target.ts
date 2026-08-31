import type {
  EmbeddingDistanceMetric,
  EmbeddingProviderTarget,
  EmbeddingRuntimeTarget,
  EmbeddingTaskMode,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import { EMBEDDING_VECTOR_SPACE_VERSION, WORKERS_EMBEDDING_MODEL } from "./constants";

export const WORKERS_EMBEDDING_DIMENSIONS = 1024;
export const CURRENT_EMBEDDING_DISTANCE_METRIC = "provider-configured" as const;
export const CURRENT_EMBEDDING_TASK_MODE = "symmetric" as const;

export type {
  EmbeddingDistanceMetric,
  EmbeddingProviderTarget,
  EmbeddingRuntimeTarget,
  EmbeddingTaskMode,
} from "~/types";

const DISTANCE_METRICS = new Set<EmbeddingDistanceMetric>([
  "cosine",
  "dot-product",
  "euclidean",
  "provider-configured",
  "unknown",
]);
const TASK_MODES = new Set<EmbeddingTaskMode>(["symmetric", "asymmetric", "unknown"]);
const TARGET_KEYS = new Set([
  "embeddingProvider",
  "providerTarget",
  "model",
  "dimensions",
  "distanceMetric",
  "taskMode",
  "vectorSpace",
  "vectorSpaceVersion",
]);

const invalidTarget = () =>
  new AssistantError("Embedding runtime target is invalid", ErrorType.CONFIGURATION_ERROR, 500);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const decodeEmbeddingRuntimeTarget = (value: unknown): EmbeddingRuntimeTarget => {
  let candidate: unknown = value;

  if (typeof value === "string") {
    try {
      candidate = JSON.parse(value);
    } catch {
      throw invalidTarget();
    }
  }

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw invalidTarget();
  }

  const record = candidate as Record<string, unknown>;

  if (
    Object.keys(record).length !== TARGET_KEYS.size ||
    Object.keys(record).some((key) => !TARGET_KEYS.has(key)) ||
    !isNonEmptyString(record.embeddingProvider) ||
    !isNonEmptyString(record.providerTarget) ||
    !isNonEmptyString(record.model) ||
    !Number.isSafeInteger(record.dimensions) ||
    (record.dimensions as number) <= 0 ||
    !DISTANCE_METRICS.has(record.distanceMetric as EmbeddingDistanceMetric) ||
    !TASK_MODES.has(record.taskMode as EmbeddingTaskMode) ||
    !isNonEmptyString(record.vectorSpace) ||
    !isNonEmptyString(record.vectorSpaceVersion)
  ) {
    throw invalidTarget();
  }

  return {
    embeddingProvider: record.embeddingProvider,
    providerTarget: record.providerTarget,
    model: record.model,
    dimensions: record.dimensions as number,
    distanceMetric: record.distanceMetric as EmbeddingDistanceMetric,
    taskMode: record.taskMode as EmbeddingTaskMode,
    vectorSpace: record.vectorSpace,
    vectorSpaceVersion: record.vectorSpaceVersion,
  };
};

export const encodeEmbeddingRuntimeTarget = (target: EmbeddingRuntimeTarget): string => {
  const parsed = decodeEmbeddingRuntimeTarget(target);

  return JSON.stringify(parsed);
};

export const getEmbeddingRuntimeTargetKey = (target: EmbeddingRuntimeTarget): string =>
  encodeEmbeddingRuntimeTarget(target);

export const embeddingRuntimeTargetsEqual = (
  left: EmbeddingRuntimeTarget,
  right: EmbeddingRuntimeTarget,
): boolean => getEmbeddingRuntimeTargetKey(left) === getEmbeddingRuntimeTargetKey(right);

export const toEmbeddingProviderTarget = (
  target: EmbeddingRuntimeTarget,
): EmbeddingProviderTarget => {
  const parsed = decodeEmbeddingRuntimeTarget(target);

  return {
    provider: parsed.embeddingProvider,
    target: parsed.providerTarget,
    model: parsed.model,
    vectorSpace: parsed.vectorSpace,
    vectorSpaceVersion: parsed.vectorSpaceVersion,
  };
};

export const toEmbeddingRuntimeTarget = (
  target: EmbeddingProviderTarget,
): EmbeddingRuntimeTarget => {
  if (
    !isNonEmptyString(target.provider) ||
    !isNonEmptyString(target.target) ||
    !isNonEmptyString(target.model) ||
    !isNonEmptyString(target.vectorSpace) ||
    !isNonEmptyString(target.vectorSpaceVersion)
  ) {
    throw invalidTarget();
  }

  if (
    target.model === "unknown-legacy" &&
    target.vectorSpaceVersion === "legacy" &&
    target.provider === "quarantined"
  ) {
    if (target.target !== "quarantined-legacy" || target.vectorSpace !== "legacy-unresolved") {
      throw invalidTarget();
    }

    return {
      embeddingProvider: target.provider,
      providerTarget: target.target,
      model: target.model,
      dimensions: 1,
      distanceMetric: "unknown",
      taskMode: "unknown",
      vectorSpace: target.vectorSpace,
      vectorSpaceVersion: target.vectorSpaceVersion,
    };
  }

  if (
    target.model !== WORKERS_EMBEDDING_MODEL ||
    target.vectorSpaceVersion !== EMBEDDING_VECTOR_SPACE_VERSION ||
    !["vectorize", "s3vectors"].includes(target.provider)
  ) {
    throw invalidTarget();
  }

  return {
    embeddingProvider: target.provider,
    providerTarget: target.target,
    model: target.model,
    dimensions: WORKERS_EMBEDDING_DIMENSIONS,
    distanceMetric: CURRENT_EMBEDDING_DISTANCE_METRIC,
    taskMode: CURRENT_EMBEDDING_TASK_MODE,
    vectorSpace: target.vectorSpace,
    vectorSpaceVersion: target.vectorSpaceVersion,
  };
};
