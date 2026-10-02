import { paginate } from "@ngriffin_uk/polychat-utility-server/arrays";

import type {
  EmbeddingQueryOptions,
  EmbeddingVector,
  EmbeddingWriteOptions,
  NumericEmbeddingQuery,
  VectorStore,
} from "~/types";

import {
  buildDynamoDbVectorSearch,
  parseDynamoDbVectorMatches,
  requireDynamoDbBatchProcessed,
  toDynamoDbAttribute,
  validateDynamoDbIds,
  validateDynamoDbVector,
} from "./dynamodb";
import type { DynamoDbVectorClient } from "./dynamodb-client";
import { requireEmbeddingScopeTag, withEmbeddingScopeMetadata } from "./scope";

export class DynamoDbVectorStore implements VectorStore {
  constructor(
    private client: Pick<DynamoDbVectorClient, "configuration" | "request" | "ensureIndex">,
  ) {}

  async insert(embeddings: EmbeddingVector[], options: EmbeddingWriteOptions = {}) {
    const scopeTag = requireEmbeddingScopeTag(options);

    validateDynamoDbIds(embeddings.map(({ id }) => id));
    const items = embeddings.map((embedding) => ({
      ...Object.fromEntries(
        Object.entries(withEmbeddingScopeMetadata(embedding.metadata, options)).map(
          ([key, value]) => [key, toDynamoDbAttribute(value)],
        ),
      ),
      id: { S: embedding.id },
      embedding: {
        L: validateDynamoDbVector(embedding.values).map((value) => ({ N: String(value) })),
      },
    }));

    if (items.length) {
      await this.client.ensureIndex();
    }

    for (const Item of items) {
      await this.client.request("PutItem", {
        Item,
        ConditionExpression: "attribute_not_exists(#id) OR #scope = :scope",
        ExpressionAttributeNames: { "#id": "id", "#scope": "scopeTag" },
        ExpressionAttributeValues: { ":scope": { S: scopeTag } },
      });
    }

    return { status: "success", error: null };
  }

  async delete(ids: string[]) {
    validateDynamoDbIds(ids, 12800);
    try {
      for (const batch of paginate(ids, 25)) {
        const data = await this.client.request("BatchWriteItem", {
          RequestItems: {
            [this.client.configuration.tableName]: batch.map((id) => ({
              DeleteRequest: { Key: { id: { S: id } } },
            })),
          },
        });

        requireDynamoDbBatchProcessed(data);
      }

      return { status: "success", error: null };
    } catch {
      return { status: "error", error: "DynamoDB Vectors delete failed" };
    }
  }

  async getMatches(queryVector: NumericEmbeddingQuery, options: EmbeddingQueryOptions = {}) {
    const search = buildDynamoDbVectorSearch(options);
    const SearchVector = validateDynamoDbVector(queryVector).map((value) => ({ N: String(value) }));

    await this.client.ensureIndex();
    const data = await this.client.request("SearchVectors", {
      ...search,
      IndexName: this.client.configuration.indexName,
      SearchVector,
    });

    return parseDynamoDbVectorMatches(data, options);
  }
}
