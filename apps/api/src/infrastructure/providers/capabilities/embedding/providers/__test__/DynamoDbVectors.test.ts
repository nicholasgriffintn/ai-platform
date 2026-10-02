import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WORKERS_EMBEDDING_MODEL } from "~/config/storage";

import { toEmbeddingRuntimeTarget } from "../../target";
import { DynamoDbVectorClient } from "../../utils/dynamodb-client";
import { DynamoDbVectorStore } from "../../utils/dynamodb-store";
import { parseRecordedDynamoDbVectorTarget } from "../../utils/dynamodb-target";
import { getEmbeddingCredentialFingerprint } from "../../utils/scope";
import {
  dynamoDbConfiguration,
  dynamoDbScopeTag,
  dynamoDbScopeSecret,
  dynamoDbTable,
  dynamoDbVector,
} from "./dynamodb-fixtures";

const getCredentials = vi.fn<() => Promise<string | null>>();
const requests: Request[] = [];
let tableResponse: unknown;
let searchResponse: unknown;
let failOperation: string | undefined;

beforeEach(() => {
  getCredentials.mockReset().mockResolvedValue("ddb-access::@@::ddb-secret");
  requests.length = 0;
  tableResponse = structuredClone(dynamoDbTable);
  searchResponse = {
    SearchResults: [
      {
        Item: {
          id: { S: "vector-1" },
          scopeTag: { S: dynamoDbScopeTag },
          type: { S: "note" },
          content: { S: "private-result-sentinel" },
        },
        Score: 0.25,
      },
    ],
  };
  failOperation = undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const request = new Request(input, init);

      requests.push(request);
      const operation = request.headers.get("X-Amz-Target")?.split(".").at(-1);

      if (operation === failOperation) {
        return Response.json(
          { __type: "AccessDeniedException", message: "private-error-sentinel" },
          { status: 403 },
        );
      }

      return Response.json(
        operation === "DescribeTable"
          ? tableResponse
          : operation === "SearchVectors"
            ? searchResponse
            : {},
      );
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("DynamoDB vector provider protocol and lifecycle", () => {
  it("signs writes and scoped searches at their respective endpoints and converts cosine distance", async () => {
    const client = new DynamoDbVectorClient(dynamoDbConfiguration, { getCredentials });
    const store = new DynamoDbVectorStore(client);

    await store.insert(
      [
        {
          id: "vector-1",
          values: new Float32Array(dynamoDbVector),
          metadata: {
            type: "note",
            documentId: "doc-1",
            chunkIndex: 0,
            scopeTag: "untrusted",
            content: "private-content-sentinel",
            userId: 42,
          },
        },
      ],
      { scopeTag: dynamoDbScopeTag },
    );
    const result = await store.getMatches(new Float64Array(dynamoDbVector), {
      scopeTag: dynamoDbScopeTag,
      contentType: "note",
      topK: 5,
    });

    expect(result).toEqual({ matches: [{ id: "vector-1", score: 0.75, metadata: {} }], count: 1 });
    expect(requests.map((request) => request.url)).toEqual([
      "https://dynamodb.eu-west-2.amazonaws.com/",
      "https://dynamodb.eu-west-2.amazonaws.com/",
      "https://search-dynamodb.eu-west-2.api.aws/",
    ]);
    expect(requests[1]?.headers.get("Authorization")).toContain("ddb-access/");
    expect(requests[1]?.headers.get("Authorization")).toContain("/eu-west-2/dynamodb/aws4_request");
    const write: unknown = await requests[1]?.json();

    expect(write).toMatchObject({
      TableName: "polychat-vectors",
      Item: {
        id: { S: "vector-1" },
        scopeTag: { S: dynamoDbScopeTag },
        type: { S: "note" },
        chunkIndex: { N: "0" },
        embedding: { L: expect.any(Array) },
      },
      ConditionExpression: "attribute_not_exists(#id) OR #scope = :scope",
    });
    expect(JSON.stringify(write)).not.toContain("private-content-sentinel");
    expect(JSON.stringify(write)).not.toContain("userId");
    const query: unknown = await requests[2]?.json();

    expect(query).toMatchObject({
      TableName: "polychat-vectors",
      IndexName: "embeddings",
      TopK: 5,
      SearchConditionExpression: "#scope = :scope AND #type = :type",
      ExpressionAttributeValues: { ":scope": { S: dynamoDbScopeTag }, ":type": { S: "note" } },
      SearchVector: dynamoDbVector.map((value) => ({ N: String(value) })),
    });
    expect(getCredentials).toHaveBeenCalledTimes(3);
  });

  it.each([
    { scopeTag: undefined },
    { scopeTag: dynamoDbScopeTag, topK: 101 },
    { scopeTag: dynamoDbScopeTag, topK: 0 },
    { scopeTag: dynamoDbScopeTag, filter: { scopeTag: "other-scope" } },
  ])("rejects invalid or unsupported search controls before I/O %#", async (options) => {
    const store = new DynamoDbVectorStore(
      new DynamoDbVectorClient(dynamoDbConfiguration, { getCredentials }),
    );

    await expect(store.getMatches(dynamoDbVector, options)).rejects.toThrow();
    expect(requests).toHaveLength(0);
    expect(getCredentials).not.toHaveBeenCalled();
  });

  it.each(
    [
      [0.1],
      Array.from({ length: 1024 }, () => 0),
      Array.from({ length: 1024 }, () => Number.NaN),
      Array.from({ length: 1024 }, () => 1e100),
    ].map((values) => ({ values })),
  )("validates all vectors before writing %#", async ({ values }) => {
    const store = new DynamoDbVectorStore(
      new DynamoDbVectorClient(dynamoDbConfiguration, { getCredentials }),
    );

    await expect(
      store.insert(
        [
          { id: "valid", values: dynamoDbVector, metadata: {} },
          { id: "invalid", values, metadata: {} },
        ],
        { scopeTag: dynamoDbScopeTag },
      ),
    ).rejects.toThrow("1,024-dimensional");
    expect(requests).toHaveLength(0);
  });

  it.each(["EUCLIDEAN", "DOT_PRODUCT"])(
    "refuses incompatible %s indexes before writes",
    async (DistanceFunction) => {
      tableResponse = {
        Table: {
          ...dynamoDbTable.Table,
          VectorIndexes: [{ ...dynamoDbTable.Table.VectorIndexes[0], DistanceFunction }],
        },
      };
      const store = new DynamoDbVectorStore(
        new DynamoDbVectorClient(dynamoDbConfiguration, { getCredentials }),
      );

      await expect(
        store.insert([{ id: "vector-1", values: dynamoDbVector, metadata: {} }], {
          scopeTag: dynamoDbScopeTag,
        }),
      ).rejects.toThrow("does not match");
      expect(requests).toHaveLength(1);
    },
  );

  it("refuses indexes without scope partitioning or while backfilling", async () => {
    const client = new DynamoDbVectorClient(dynamoDbConfiguration, { getCredentials });

    tableResponse = {
      Table: {
        ...dynamoDbTable.Table,
        VectorIndexes: [{ ...dynamoDbTable.Table.VectorIndexes[0], SearchSchema: [] }],
      },
    };
    await expect(client.ensureIndex()).rejects.toThrow("does not match");
    tableResponse = {
      Table: {
        ...dynamoDbTable.Table,
        VectorIndexes: [{ ...dynamoDbTable.Table.VectorIndexes[0], Backfilling: true }],
      },
    };
    await expect(
      new DynamoDbVectorClient(dynamoDbConfiguration, { getCredentials }).ensureIndex(),
    ).rejects.toThrow("not ready");
  });

  it.each([
    {
      SearchResults: [
        { Item: { id: { S: "vector-1" }, scopeTag: { S: "other-scope" } }, Score: 0.2 },
      ],
    },
    {
      SearchResults: [
        {
          Item: { id: { S: "vector-1" }, scopeTag: { S: dynamoDbScopeTag }, type: { S: "memory" } },
          Score: 0.2,
        },
      ],
    },
    { SearchResults: [{ Item: { id: { S: "vector-1" } }, Score: 0.2 }] },
    {
      SearchResults: [
        { Item: { id: { S: "vector-1" }, scopeTag: { S: dynamoDbScopeTag } }, Score: "invalid" },
      ],
    },
  ])("fails closed on malformed or out-of-scope matches %#", async (response) => {
    searchResponse = response;
    const store = new DynamoDbVectorStore(
      new DynamoDbVectorClient(dynamoDbConfiguration, { getCredentials }),
    );

    await expect(
      store.getMatches(dynamoDbVector, { scopeTag: dynamoDbScopeTag, contentType: "note" }),
    ).rejects.toThrow("Invalid or unscoped");
  });

  it("blocks credential rotation before both historical reads and cleanup", async () => {
    const expectedCredentialFingerprint = await getEmbeddingCredentialFingerprint(
      dynamoDbScopeSecret,
      "original-access::@@::original-secret",
    );
    const store = new DynamoDbVectorStore(
      new DynamoDbVectorClient(dynamoDbConfiguration, {
        getCredentials,
        expectedCredentialFingerprint,
        scopeSecret: dynamoDbScopeSecret,
      }),
    );

    await expect(store.getMatches(dynamoDbVector, { scopeTag: dynamoDbScopeTag })).rejects.toThrow(
      "credentials changed",
    );
    expect(await store.delete(["vector-1"])).toEqual({
      status: "error",
      error: "DynamoDB Vectors delete failed",
    });
    expect(requests).toHaveLength(0);
  });

  it("fails closed when user credentials are missing or invalid", async () => {
    const client = new DynamoDbVectorClient(dynamoDbConfiguration, { getCredentials });

    getCredentials.mockResolvedValueOnce(null).mockResolvedValueOnce("::@@::");
    await expect(client.request("BatchWriteItem", {})).rejects.toThrow("not configured");
    await expect(client.request("BatchWriteItem", {})).rejects.toThrow("Invalid AWS credentials");
    expect(requests).toHaveLength(0);
  });

  it("keeps uncertain writes available for explicit cleanup and reports failed deletion", async () => {
    const store = new DynamoDbVectorStore(
      new DynamoDbVectorClient(dynamoDbConfiguration, { getCredentials }),
    );

    failOperation = "PutItem";
    await expect(
      store.insert([{ id: "vector-1", values: dynamoDbVector, metadata: {} }], {
        scopeTag: dynamoDbScopeTag,
      }),
    ).rejects.toThrow("DynamoDB Vectors request failed");
    failOperation = undefined;
    expect(await store.delete(["vector-1", "vector-2"])).toEqual({
      status: "success",
      error: null,
    });
    expect(await requests[2]?.json()).toEqual({
      RequestItems: {
        "polychat-vectors": [
          { DeleteRequest: { Key: { id: { S: "vector-1" } } } },
          { DeleteRequest: { Key: { id: { S: "vector-2" } } } },
        ],
      },
    });
    failOperation = "BatchWriteItem";
    expect(await store.delete(["vector-1"])).toEqual({
      status: "error",
      error: "DynamoDB Vectors delete failed",
    });
  });

  it("cleans up without requiring a ready vector index", async () => {
    tableResponse = {};
    const store = new DynamoDbVectorStore(
      new DynamoDbVectorClient(dynamoDbConfiguration, { getCredentials }),
    );

    expect(await store.delete(["vector-1"])).toEqual({ status: "success", error: null });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.headers.get("X-Amz-Target")).toBe("DynamoDB_20120810.BatchWriteItem");
  });

  it("rejects endpoints disguised as regions before credential lookup", () => {
    expect(
      () =>
        new DynamoDbVectorClient(
          { ...dynamoDbConfiguration, region: "localhost/secret" },
          { getCredentials },
        ),
    ).toThrow("valid configuration");
    expect(getCredentials).not.toHaveBeenCalled();
  });

  it("preserves recorded configuration and cosine compatibility independently of current settings", () => {
    const recorded = {
      ...dynamoDbConfiguration,
      credentialFingerprint: `credential_v1_${"b".repeat(32)}`,
    };
    const target = {
      provider: "dynamodb-vectors",
      target: JSON.stringify(recorded),
      model: WORKERS_EMBEDDING_MODEL,
      vectorSpace: recorded.indexName,
      vectorSpaceVersion: "v1",
    };

    expect(parseRecordedDynamoDbVectorTarget(target)).toEqual(recorded);
    expect(toEmbeddingRuntimeTarget(target)).toMatchObject({
      embeddingProvider: "dynamodb-vectors",
      dimensions: 1024,
      distanceMetric: "cosine",
    });
    expect(() => parseRecordedDynamoDbVectorTarget({ ...target, model: "another-model" })).toThrow(
      "provenance",
    );
    expect(() =>
      parseRecordedDynamoDbVectorTarget({ ...target, vectorSpace: "another-index" }),
    ).toThrow("provenance");
    expect(() => parseRecordedDynamoDbVectorTarget({ ...target, target: "null" })).toThrow(
      "provenance",
    );
  });
  it("batches multi-document cleanup and retains an error for unprocessed deletions", async () => {
    const store = new DynamoDbVectorStore(
      new DynamoDbVectorClient(dynamoDbConfiguration, { getCredentials }),
    );
    const ids = Array.from({ length: 129 }, (_, index) => `vector-${index}`);

    expect(await store.delete(ids)).toEqual({ status: "success", error: null });
    expect(requests).toHaveLength(6);
    expect(await requests[5]?.json()).toEqual({
      RequestItems: {
        "polychat-vectors": ids
          .slice(125)
          .map((id) => ({ DeleteRequest: { Key: { id: { S: id } } } })),
      },
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        UnprocessedItems: {
          "polychat-vectors": [{ DeleteRequest: { Key: { id: { S: "vector-1" } } } }],
        },
      }),
    );
    expect(await store.delete(["vector-1"])).toEqual({
      status: "error",
      error: "DynamoDB Vectors delete failed",
    });
  });
});
