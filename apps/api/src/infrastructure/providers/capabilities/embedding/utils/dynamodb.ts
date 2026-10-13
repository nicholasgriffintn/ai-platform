import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import type { EmbeddingQueryOptions, EmbeddingQueryResult, NumericEmbeddingQuery } from "~/types";

import { WORKERS_EMBEDDING_DIMENSIONS } from "../target";
import { requireEmbeddingScopeTag } from "./scope";

export type DynamoDbAttributeValue =
  | { S: string }
  | { N: string }
  | { BOOL: boolean }
  | { L: DynamoDbAttributeValue[] };

export function toDynamoDbAttribute(value: unknown): DynamoDbAttributeValue {
  if (typeof value === "string") {
    return { S: value };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return { N: String(value) };
  }

  if (typeof value === "boolean") {
    return { BOOL: value };
  }

  if (Array.isArray(value)) {
    return { L: value.map(toDynamoDbAttribute) };
  }

  throw new AssistantError("Unsupported DynamoDB attribute value", ErrorType.PARAMS_ERROR, 400);
}

export function validateDynamoDbVector(vector: NumericEmbeddingQuery): number[] {
  const values = Array.from(vector);

  if (
    values.length !== WORKERS_EMBEDDING_DIMENSIONS ||
    values.some((value) => !Number.isFinite(value) || !Number.isFinite(Math.fround(value))) ||
    values.every((value) => value === 0)
  ) {
    throw new AssistantError(
      "DynamoDB Vectors requires a finite, non-zero 1,024-dimensional vector",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return values;
}

export function validateDynamoDbIds(ids: string[], maximumCount = 128): void {
  if (
    ids.length > maximumCount ||
    ids.some((id) => !id || new TextEncoder().encode(id).length > 2048) ||
    new Set(ids).size !== ids.length
  ) {
    throw new AssistantError(
      "Invalid DynamoDB vector IDs or batch size",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }
}

export function buildDynamoDbVectorSearch(options: EmbeddingQueryOptions) {
  const scopeTag = requireEmbeddingScopeTag(options);
  const topK = options.topK ?? 15;

  if (!Number.isInteger(topK) || topK < 1 || topK > 100) {
    throw new AssistantError(
      "DynamoDB vector topK must be between 1 and 100",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (options.filter && Object.keys(options.filter).length > 0) {
    throw new AssistantError(
      "DynamoDB Vectors does not support custom metadata filters",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return {
    TopK: topK,
    SearchConditionExpression: options.contentType
      ? "#scope = :scope AND #type = :type"
      : "#scope = :scope",
    ExpressionAttributeNames: {
      "#scope": "scopeTag",
      ...(options.contentType && { "#type": "type" }),
    },
    ExpressionAttributeValues: {
      ":scope": { S: scopeTag },
      ...(options.contentType && { ":type": { S: options.contentType } }),
    },
  };
}

const tableDescriptionSchema = z.object({
  Table: z.object({
    KeySchema: z.array(z.object({ AttributeName: z.string(), KeyType: z.string() })),
    AttributeDefinitions: z.array(
      z.object({ AttributeName: z.string(), AttributeType: z.string() }),
    ),
    BillingModeSummary: z.object({ BillingMode: z.string() }),
    VectorIndexes: z.array(
      z.object({
        IndexName: z.string(),
        IndexStatus: z.string(),
        Backfilling: z.boolean().optional(),
        Dimensions: z.number(),
        DistanceFunction: z.string(),
        VectorAttribute: z.object({ AttributeName: z.string() }),
        SearchSchema: z
          .array(z.object({ AttributeName: z.string(), SearchSchemaElementType: z.string() }))
          .default([]),
        Projection: z.object({ ProjectionType: z.string() }),
      }),
    ),
  }),
});

export function validateDynamoDbVectorIndex(value: unknown, indexName: string): void {
  const parsed = tableDescriptionSchema.safeParse(value);

  if (!parsed.success) {
    throw new AssistantError(
      "DynamoDB vector table schema is unavailable",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  const table = parsed.data.Table;
  const index = table.VectorIndexes.find((candidate) => candidate.IndexName === indexName);

  if (
    table.KeySchema.length !== 1 ||
    table.KeySchema[0]?.AttributeName !== "id" ||
    table.KeySchema[0]?.KeyType !== "HASH" ||
    !["id", "scopeTag", "type"].every((name) =>
      table.AttributeDefinitions.some(
        (attribute) => attribute.AttributeName === name && attribute.AttributeType === "S",
      ),
    ) ||
    table.BillingModeSummary.BillingMode !== "PAY_PER_REQUEST" ||
    !index ||
    index.Dimensions !== WORKERS_EMBEDDING_DIMENSIONS ||
    index.DistanceFunction !== "COSINE" ||
    index.VectorAttribute.AttributeName !== "embedding" ||
    index.Projection.ProjectionType !== "ALL" ||
    !index.SearchSchema.some(
      (attribute) =>
        attribute.AttributeName === "scopeTag" && attribute.SearchSchemaElementType === "HASH",
    ) ||
    !index.SearchSchema.some(
      (attribute) =>
        attribute.AttributeName === "type" && attribute.SearchSchemaElementType === "INLINE_FILTER",
    )
  ) {
    throw new AssistantError(
      "DynamoDB table or vector index does not match the Polychat schema",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  if (index.IndexStatus !== "ACTIVE" || index.Backfilling) {
    throw new AssistantError(
      "DynamoDB vector index is not ready for use",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }
}

const searchResponseSchema = z.object({
  SearchResults: z.array(
    z.object({
      Item: z.object({
        id: z.object({ S: z.string().min(1) }),
        scopeTag: z.object({ S: z.string() }),
        type: z.object({ S: z.string() }).optional(),
      }),
      Score: z.number().min(0).max(2),
    }),
  ),
});

export function parseDynamoDbVectorMatches(
  value: unknown,
  options: EmbeddingQueryOptions,
): EmbeddingQueryResult {
  const parsed = searchResponseSchema.safeParse(value);
  const scopeTag = requireEmbeddingScopeTag(options);

  if (
    !parsed.success ||
    parsed.data.SearchResults.some(
      ({ Item }) =>
        Item.scopeTag.S !== scopeTag ||
        (options.contentType && Item.type?.S !== options.contentType),
    )
  ) {
    throw new AssistantError(
      "Invalid or unscoped DynamoDB vector search response",
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  const matches = parsed.data.SearchResults.map(({ Item, Score }) => ({
    id: Item.id.S,
    score: 1 - Score,
    metadata: {},
  }));

  return { matches, count: matches.length };
}

export function readDynamoDbErrorCode(value: unknown): string | undefined {
  return isRecord(value) && typeof value.__type === "string"
    ? value.__type.split("#").at(-1)
    : undefined;
}

const batchWriteResponseSchema = z.object({
  UnprocessedItems: z.record(z.string(), z.array(z.unknown())).optional(),
});

export function requireDynamoDbBatchProcessed(value: unknown): void {
  const parsed = batchWriteResponseSchema.safeParse(value);

  if (
    !parsed.success ||
    Object.values(parsed.data.UnprocessedItems ?? {}).some((items) => items.length > 0)
  ) {
    throw new AssistantError(
      "DynamoDB vector deletion is incomplete",
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }
}
