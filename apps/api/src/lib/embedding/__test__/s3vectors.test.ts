import { describe, expect, it, vi } from "vitest";

import { S3VectorsEmbeddingProvider } from "../s3vectors";
import type { IEnv } from "~/types";

const mockEnv: IEnv = {
  DB: {} as any,
  AI: {
    run: vi.fn(),
  } as any,
  VECTOR_DB: {} as any,
  AWS_REGION: "us-east-1",
  S3VECTORS_AWS_ACCESS_KEY: "test-access-key",
  S3VECTORS_AWS_SECRET_KEY: "test-secret-key",
} as any;

const mockUser = { id: 1 };

describe("S3VectorsEmbeddingProvider", () => {
  it("should initialize with required config", () => {
    const provider = new S3VectorsEmbeddingProvider(
      {
        bucketName: "test-bucket",
        indexName: "test-index",
        region: "us-east-1",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        ai: mockEnv.AI,
      },
      mockEnv,
      mockUser as any,
    );

    expect(provider).toBeDefined();
  });

  it("should generate embeddings using BGE model", async () => {
    const mockResponse = {
      data: [[0.1, 0.2, 0.3, 0.4]],
    };

    const mockAI = {
      run: vi.fn().mockResolvedValue(mockResponse),
    };

    const provider = new S3VectorsEmbeddingProvider(
      {
        bucketName: "test-bucket",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        ai: mockAI as any,
      },
      mockEnv,
      mockUser as any,
    );

    const result = await provider.generate("text", "test content", "test-id", {
      source: "test",
    });

    expect(mockAI.run).toHaveBeenCalledWith(
      "@cf/baai/bge-base-en-v1.5",
      { text: ["test content"] },
      {
        gateway: {
          id: "llm-assistant",
          skipCache: false,
          cacheTtl: 259200,
        },
      },
    );

    expect(result).toEqual([
      {
        id: "test-id",
        values: [0.1, 0.2, 0.3, 0.4],
        metadata: {
          source: "test",
          type: "text",
          content: "test content",
        },
      },
    ]);
  });

  it("should insert vectors via S3 Vectors API", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    const mockAwsClient = {
      fetch: mockFetch,
    };

    const provider = new S3VectorsEmbeddingProvider(
      {
        bucketName: "test-bucket",
        indexName: "test-index",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        ai: mockEnv.AI,
      },
      mockEnv,
      mockUser as any,
    );

    vi.spyOn(provider as any, "getAwsClient").mockResolvedValue(mockAwsClient);

    const embeddings = [
      {
        id: "test-1",
        values: [0.1, 0.2, 0.3],
        metadata: { type: "text", content: "test" },
      },
    ];

    const result = await provider.insert(embeddings);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://s3vectors.us-east-1.api.aws/PutVectors",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vectorBucketName: "test-bucket",
          indexName: "test-index",
          vectors: [
            {
              key: "test-1",
              data: { float32: [0.1, 0.2, 0.3] },
              metadata: { type: "text", content: "test" },
            },
          ],
        }),
      },
    );

    expect(result).toEqual({
      status: "success",
      error: null,
    });
  });

  it("should delete vectors via S3 Vectors API", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    const mockAwsClient = {
      fetch: mockFetch,
    };

    const provider = new S3VectorsEmbeddingProvider(
      {
        bucketName: "test-bucket",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        ai: mockEnv.AI,
      },
      mockEnv,
      mockUser as any,
    );

    vi.spyOn(provider as any, "getAwsClient").mockResolvedValue(mockAwsClient);

    const result = await provider.delete(["test-1", "test-2"]);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://s3vectors.us-east-1.api.aws/DeleteVectors",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vectorBucketName: "test-bucket",
          indexName: undefined,
          keys: ["test-1", "test-2"],
        }),
      },
    );

    expect(result).toEqual({
      status: "success",
      error: null,
    });
  });

  it("should query vectors via S3 Vectors API", async () => {
    const mockQueryResponse = {
      vectors: [
        {
          key: "test-1",
          distance: 0.1,
          metadata: { type: "text", content: "test content", title: "Test" },
        },
        {
          key: "test-2",
          distance: 0.3,
          metadata: { type: "text", content: "another test", title: "Another" },
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockQueryResponse),
    });

    const mockAwsClient = {
      fetch: mockFetch,
    };

    const provider = new S3VectorsEmbeddingProvider(
      {
        bucketName: "test-bucket",
        indexName: "test-index",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        ai: mockEnv.AI,
      },
      mockEnv,
      mockUser as any,
    );

    vi.spyOn(provider as any, "getAwsClient").mockResolvedValue(mockAwsClient);

    const queryVector = [0.1, 0.2, 0.3, 0.4];
    const result = await provider.getMatches(queryVector, { topK: 5 });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://s3vectors.us-east-1.api.aws/QueryVectors",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vectorBucketName: "test-bucket",
          topK: 5,
          returnDistance: true,
          returnMetadata: true,
          queryVector: { float32: queryVector },
          indexName: "test-index",
        }),
      },
    );

    expect(result).toEqual({
      matches: [
        {
          id: "test-1",
          score: 0.9, // 1 - 0.1
          title: "Test",
          content: "test content",
          metadata: { type: "text", content: "test content", title: "Test" },
        },
        {
          id: "test-2",
          score: 0.7, // 1 - 0.3
          title: "Another",
          content: "another test",
          metadata: { type: "text", content: "another test", title: "Another" },
        },
      ],
      count: 2,
    });
  });

  it("should search similar documents end-to-end", async () => {
    const mockEmbedResponse = {
      data: [[0.1, 0.2, 0.3, 0.4]],
    };

    const mockQueryResponse = {
      vectors: [
        {
          key: "doc-1",
          distance: 0.2,
          metadata: {
            type: "text",
            content: "Similar document",
            title: "Doc 1",
          },
        },
      ],
    };

    const mockAI = {
      run: vi.fn().mockResolvedValue(mockEmbedResponse),
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockQueryResponse),
    });

    const mockAwsClient = {
      fetch: mockFetch,
    };

    const provider = new S3VectorsEmbeddingProvider(
      {
        bucketName: "test-bucket",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        ai: mockAI as any,
      },
      mockEnv,
      mockUser as any,
    );

    vi.spyOn(provider as any, "getAwsClient").mockResolvedValue(mockAwsClient);

    const result = await provider.searchSimilar("test query", { topK: 3 });

    expect(mockAI.run).toHaveBeenCalledWith(
      "@cf/baai/bge-base-en-v1.5",
      { text: ["test query"] },
      expect.any(Object),
    );

    expect(result).toEqual([
      {
        title: "Doc 1",
        content: "Similar document",
        metadata: { type: "text", content: "Similar document", title: "Doc 1" },
        score: 0.8, // 1 - 0.2
        type: "text",
      },
    ]);
  });

  it("should handle API errors gracefully", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: () => Promise.resolve("Invalid request"),
    });

    const mockAwsClient = {
      fetch: mockFetch,
    };

    const provider = new S3VectorsEmbeddingProvider(
      {
        bucketName: "test-bucket",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        ai: mockEnv.AI,
      },
      mockEnv,
      mockUser as any,
    );

    vi.spyOn(provider as any, "getAwsClient").mockResolvedValue(mockAwsClient);

    const embeddings = [
      {
        id: "test-1",
        values: [0.1, 0.2, 0.3],
        metadata: { type: "text" },
      },
    ];

    await expect(provider.insert(embeddings)).rejects.toThrow(
      "S3 Vectors API error: Bad Request - Invalid request",
    );
  });
});
