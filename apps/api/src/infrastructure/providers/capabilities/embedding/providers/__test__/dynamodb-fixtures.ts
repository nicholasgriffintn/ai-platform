export const dynamoDbConfiguration = {
  tableName: "polychat-vectors",
  indexName: "embeddings",
  region: "eu-west-2",
};
export const dynamoDbScopeTag = `scope_v1_${"a".repeat(32)}`;
export const dynamoDbScopeSecret = "test-dynamodb-vector-scope-secret-at-least-32-characters";
export const dynamoDbVector = Array.from({ length: 1024 }, () => 0.1);
export const dynamoDbTable = {
  Table: {
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "scopeTag", AttributeType: "S" },
      { AttributeName: "type", AttributeType: "S" },
    ],
    BillingModeSummary: { BillingMode: "PAY_PER_REQUEST" },
    VectorIndexes: [
      {
        IndexName: "embeddings",
        IndexStatus: "ACTIVE",
        Dimensions: 1024,
        DistanceFunction: "COSINE",
        VectorAttribute: { AttributeName: "embedding" },
        Projection: { ProjectionType: "ALL" },
        SearchSchema: [
          { AttributeName: "scopeTag", SearchSchemaElementType: "HASH" },
          { AttributeName: "type", SearchSchemaElementType: "INLINE_FILTER" },
        ],
      },
    ],
  },
};
