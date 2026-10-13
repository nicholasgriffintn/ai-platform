import type { Ai } from "@cloudflare/workers-types";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import type {
  EmbeddingProvider,
  EmbeddingMetadata,
  EmbeddingQueryOptions,
  EmbeddingVector,
  EmbeddingWriteOptions,
  IEnv,
  IUser,
  NumericEmbeddingQuery,
} from "~/types";

import { DynamoDbVectorClient, type DynamoDbVectorConfiguration } from "../utils/dynamodb-client";
import { DynamoDbVectorStore } from "../utils/dynamodb-store";
import { WorkersEmbedder } from "../utils/workers-embedder";

export interface DynamoDbVectorsEmbeddingProviderConfig extends DynamoDbVectorConfiguration {
  ai: Ai;
  expectedCredentialFingerprint?: string;
}

export class DynamoDbVectorsEmbeddingProvider implements EmbeddingProvider {
  private store: DynamoDbVectorStore;
  private embedder: WorkersEmbedder;

  constructor(config: DynamoDbVectorsEmbeddingProviderConfig, env: IEnv, user: IUser) {
    if (!env.DB || !user?.id) {
      throw new AssistantError(
        "DynamoDB Vectors requires an authenticated user and database",
        ErrorType.CONFIGURATION_ERROR,
        503,
      );
    }

    const client = new DynamoDbVectorClient(
      { tableName: config.tableName, indexName: config.indexName, region: config.region },
      {
        getCredentials: () =>
          new UserSettingsRepository(env).getProviderApiKey(user.id, "dynamodb-vectors"),
        scopeSecret: env.EMBEDDING_SCOPE_SECRET,
        expectedCredentialFingerprint: config.expectedCredentialFingerprint,
      },
    );

    this.store = new DynamoDbVectorStore(client);
    this.embedder = new WorkersEmbedder(config.ai);
  }

  generate(type: string, content: string, id: string, metadata: EmbeddingMetadata) {
    return this.embedder.generate(type, content, id, metadata);
  }

  getQuery(query: string) {
    return this.embedder.getQuery(query);
  }

  insert(embeddings: EmbeddingVector[], options: EmbeddingWriteOptions = {}) {
    return this.store.insert(embeddings, options);
  }

  delete(ids: string[]) {
    return this.store.delete(ids);
  }

  getMatches(queryVector: NumericEmbeddingQuery, options: EmbeddingQueryOptions = {}) {
    return this.store.getMatches(queryVector, options);
  }
}
