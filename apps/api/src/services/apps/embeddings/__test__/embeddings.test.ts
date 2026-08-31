import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError, ErrorType } from "~/utils/errors";

const provider = vi.hoisted(() => ({
  delete: vi.fn(),
  generate: vi.fn(),
  getMatches: vi.fn(),
  getQuery: vi.fn(),
  insert: vi.fn(),
  searchSimilar: vi.fn(),
}));

vi.mock("~/lib/providers/capabilities/embedding/helpers", () => ({
  getEmbeddingProvider: vi.fn(() => provider),
  getEmbeddingProviderForTarget: vi.fn(() => provider),
  isQuarantinedEmbeddingProviderTarget: vi.fn(
    (target: { provider: string }) => target.provider === "quarantined",
  ),
  resolveEmbeddingProviderTarget: vi.fn(() => ({
    provider: "vectorize",
    target: "vectorize-binding",
    model: "@cf/baai/bge-large-en-v1.5",
    vectorSpace: "default",
    vectorSpaceVersion: "v1",
  })),
}));

vi.mock("~/lib/context/serviceContext", () => ({
  resolveServiceContext: vi.fn(({ context }) => context),
}));

import { deleteEmbedding } from "../delete";
import { insertEmbedding } from "../insert";
import { generateEmbeddingVectors } from "../lifecycle";
import { queryEmbeddings } from "../query";

const createContext = (userId: number, embeddings: Record<string, ReturnType<typeof vi.fn>>) =>
  ({
    env: { EMBEDDING_SCOPE_SECRET: "test-embedding-scope-secret-32-characters" },
    repositories: {
      embeddings: {
        getActiveProviderTargets: vi.fn().mockResolvedValue([
          {
            provider: "vectorize",
            providerTarget: "vectorize-binding",
            embeddingModel: "@cf/baai/bge-large-en-v1.5",
            vectorSpace: "default",
            vectorSpaceVersion: "v1",
          },
        ]),
        getDocumentLifecycleStatus: vi.fn().mockResolvedValue("pending"),
        getPendingDocumentForRetry: vi.fn().mockResolvedValue(null),
        ...embeddings,
      },
    },
    requireUser: () => ({ id: userId }),
    getUserSettings: vi.fn().mockResolvedValue({ embedding_provider: "vectorize" }),
    getLogger: vi.fn(() => ({ error: vi.fn(), warn: vi.fn() })),
  }) as any;

describe("personal embedding services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    provider.generate.mockImplementation(
      async (_type: string, _content: string, id: string, metadata: Record<string, unknown>) => [
        { id, values: [0.1], metadata },
      ],
    );
    provider.insert.mockResolvedValue({ status: "success", error: null });
  });

  it("uses server-generated physical IDs so the same logical ID cannot collide across users", async () => {
    const repository = {
      activateDocument: vi.fn().mockResolvedValue(undefined),
      createDocument: vi.fn().mockResolvedValue(undefined),
      removePendingDocument: vi.fn().mockResolvedValue(undefined),
    };

    const first = await insertEmbedding({
      context: createContext(41, repository),
      request: { id: "shared-note", type: "note", content: "First user's note" },
    });
    const second = await insertEmbedding({
      context: createContext(42, repository),
      request: { id: "shared-note", type: "note", content: "Second user's note" },
    });

    expect(first.data.id).toBe("shared-note");
    expect(second.data.id).toBe("shared-note");
    const physicalIds = provider.generate.mock.calls.map((call) => call[2]);

    expect(physicalIds).toHaveLength(2);
    expect(physicalIds[0]).not.toBe("shared-note");
    expect(physicalIds[1]).not.toBe("shared-note");
    expect(physicalIds[0]).not.toBe(physicalIds[1]);
    expect(physicalIds.every((id) => /^[\x20-\x7E]{1,64}$/.test(id))).toBe(true);
  });

  it("rejects client authority and input limits before provider use", async () => {
    const repository = {
      activateDocument: vi.fn(),
      createDocument: vi.fn(),
      removePendingDocument: vi.fn(),
    };

    await expect(
      insertEmbedding({
        context: createContext(42, repository),
        request: {
          type: "note",
          content: "Private note",
          namespace: "user_kb_999",
        },
      }),
    ).rejects.toMatchObject({ type: "PARAMS_ERROR", statusCode: 400 });

    expect(provider.generate).not.toHaveBeenCalled();
    expect(provider.insert).not.toHaveBeenCalled();
    expect(repository.createDocument).not.toHaveBeenCalled();
  });

  it("stores one document with every generated chunk", async () => {
    const repository = {
      activateDocument: vi.fn().mockResolvedValue(undefined),
      createDocument: vi.fn().mockResolvedValue(undefined),
      removePendingDocument: vi.fn().mockResolvedValue(undefined),
    };

    await insertEmbedding({
      context: createContext(42, repository),
      request: { id: "long-note", type: "note", content: "a".repeat(3000) },
    });

    expect(repository.createDocument).toHaveBeenCalledOnce();
    expect(repository.createDocument.mock.calls[0]?.[0].chunks).toHaveLength(2);
    expect(provider.generate).toHaveBeenCalledTimes(2);
    expect(repository.activateDocument).toHaveBeenCalledOnce();
  });

  it("bounds model generation concurrency for a maximum-size document", async () => {
    let active = 0;
    let maximumActive = 0;

    provider.generate.mockImplementation(
      async (_type: string, _content: string, id: string, metadata: Record<string, unknown>) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        active -= 1;

        return [{ id, values: [0.1], metadata }];
      },
    );
    const chunks = Array.from({ length: 128 }, (_, index) => ({
      id: `chunk-${index}`,
      vectorId: `vector-${index}`,
      index,
      content: `Chunk ${index}`,
    }));

    const vectors = await generateEmbeddingVectors(provider, "document-1", "note", chunks);

    expect(vectors).toHaveLength(128);
    expect(maximumActive).toBe(8);
    expect(vectors.map(({ id }) => id)).toEqual(chunks.map(({ vectorId }) => vectorId));
  });

  it("keeps public document metadata out of provider vectors", async () => {
    const repository = {
      activateDocument: vi.fn().mockResolvedValue(undefined),
      createDocument: vi.fn().mockResolvedValue(undefined),
      removePendingDocument: vi.fn().mockResolvedValue(undefined),
    };

    await insertEmbedding({
      context: createContext(42, repository),
      request: {
        id: "private-note",
        type: "note",
        content: "Private note content",
        metadata: { visibility: "private", source: "personal" },
      },
    });

    const insertedVector = provider.insert.mock.calls[0]?.[0][0];

    expect(insertedVector.content).toBe("Private note content");
    expect(insertedVector.metadata).toEqual({
      documentId: expect.stringMatching(/^embdoc_/),
      chunkId: expect.stringMatching(/^embchk_/),
      chunkIndex: 0,
      type: "note",
    });
    expect(insertedVector.metadata).not.toHaveProperty("visibility");
    expect(insertedVector.metadata).not.toHaveProperty("source");
    expect(insertedVector.metadata).not.toHaveProperty("content");
    expect(insertedVector.metadata).not.toHaveProperty("userId");
    expect(insertedVector.metadata).not.toHaveProperty("namespace");
    expect(repository.createDocument.mock.calls[0]?.[0].metadata).toEqual({
      visibility: "private",
      source: "personal",
    });
  });

  it("removes an inactive document when provider insertion fails", async () => {
    provider.insert.mockRejectedValue(new Error("provider unavailable"));
    provider.delete.mockResolvedValue({ status: "success", error: null });
    const repository = {
      activateDocument: vi.fn(),
      createDocument: vi.fn().mockResolvedValue(undefined),
      removePendingDocument: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      insertEmbedding({
        context: createContext(42, repository),
        request: { id: "note-1", type: "note", content: "Private note" },
      }),
    ).rejects.toMatchObject({ type: "PROVIDER_ERROR", statusCode: 502 });

    expect(repository.activateDocument).not.toHaveBeenCalled();
    expect(provider.delete).toHaveBeenCalledOnce();
    expect(repository.removePendingDocument).toHaveBeenCalledOnce();
  });

  it("removes a pending document without provider cleanup when vector generation fails", async () => {
    provider.generate.mockRejectedValue(new Error("model unavailable"));
    const repository = {
      activateDocument: vi.fn(),
      createDocument: vi.fn().mockResolvedValue(undefined),
      removePendingDocument: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      insertEmbedding({
        context: createContext(42, repository),
        request: { id: "note-1", type: "note", content: "Private note" },
      }),
    ).rejects.toMatchObject({ type: "PROVIDER_ERROR", statusCode: 502 });

    expect(provider.insert).not.toHaveBeenCalled();
    expect(provider.delete).not.toHaveBeenCalled();
    expect(repository.removePendingDocument).toHaveBeenCalledOnce();
  });

  it.each([
    ["throws", () => provider.delete.mockRejectedValue(new Error("cleanup unavailable"))],
    [
      "returns an error",
      () => provider.delete.mockResolvedValue({ status: "error", error: "cleanup unavailable" }),
    ],
  ])("keeps the pending document when provider cleanup %s", async (_case, failCleanup) => {
    provider.insert.mockRejectedValue(new Error("provider unavailable"));
    failCleanup();
    const repository = {
      activateDocument: vi.fn(),
      createDocument: vi.fn().mockResolvedValue(undefined),
      removePendingDocument: vi.fn(),
    };

    await expect(
      insertEmbedding({
        context: createContext(42, repository),
        request: { id: "note-1", type: "note", content: "Private note" },
      }),
    ).rejects.toMatchObject({ type: "PROVIDER_ERROR", statusCode: 502 });

    expect(provider.delete).toHaveBeenCalledOnce();
    expect(repository.removePendingDocument).not.toHaveBeenCalled();
  });

  it("hydrates provider matches from active scoped records instead of provider metadata", async () => {
    provider.getQuery.mockResolvedValue({ data: [[0.2]], status: { success: true } });
    provider.getMatches.mockResolvedValue({
      count: 2,
      matches: [
        {
          id: "trusted-vector",
          score: 0.91,
          metadata: { content: "poisoned content", userId: "999" },
        },
        {
          id: "foreign-vector",
          score: 0.99,
          metadata: { content: "foreign content", userId: "999" },
        },
      ],
    });
    const repository = {
      getActiveChunksByVectorIds: vi.fn().mockResolvedValue([
        {
          vectorId: "trusted-vector",
          logicalId: "note-1",
          title: "Trusted title",
          content: "Authoritative content",
          type: "note",
          metadata: { tag: "trusted" },
          provider: "vectorize",
          providerTarget: "vectorize-binding",
          embeddingModel: "@cf/baai/bge-large-en-v1.5",
          vectorSpace: "default",
          vectorSpaceVersion: "v1",
        },
      ]),
    };

    const result = await queryEmbeddings({
      context: createContext(42, repository),
      request: { query: "private note", type: "note" },
    });

    expect(result.data).toEqual([
      {
        id: "note-1",
        title: "Trusted title",
        content: "Authoritative content",
        type: "note",
        metadata: { tag: "trusted" },
        score: 0.91,
      },
    ]);
    expect(repository.getActiveChunksByVectorIds).toHaveBeenCalledWith(
      42,
      ["foreign-vector", "trusted-vector"],
      "note",
    );
  });

  it("queries every active stored provider target after a provider setting change", async () => {
    provider.getQuery.mockResolvedValue({ data: [[0.2]], status: { success: true } });
    provider.getMatches
      .mockResolvedValueOnce({
        count: 1,
        matches: [{ id: "vector-old", score: 0.8, metadata: {} }],
      })
      .mockResolvedValueOnce({
        count: 1,
        matches: [{ id: "vector-new", score: 0.9, metadata: {} }],
      });
    const repository = {
      getActiveProviderTargets: vi.fn().mockResolvedValue([
        {
          provider: "vectorize",
          providerTarget: "vectorize-binding",
          embeddingModel: "@cf/baai/bge-large-en-v1.5",
          vectorSpace: "default",
          vectorSpaceVersion: "v1",
        },
        {
          provider: "s3vectors",
          providerTarget: JSON.stringify({
            bucketName: "vectors",
            indexName: "notes",
            region: "eu-west-2",
          }),
          embeddingModel: "@cf/baai/bge-large-en-v1.5",
          vectorSpace: "notes",
          vectorSpaceVersion: "v1",
        },
      ]),
      getActiveChunksByVectorIds: vi.fn().mockResolvedValue([
        {
          vectorId: "vector-old",
          logicalId: "old",
          title: "Old provider",
          content: "Old content",
          type: "note",
          metadata: {},
          provider: "vectorize",
          providerTarget: "vectorize-binding",
          embeddingModel: "@cf/baai/bge-large-en-v1.5",
          vectorSpace: "default",
          vectorSpaceVersion: "v1",
        },
        {
          vectorId: "vector-new",
          logicalId: "new",
          title: "New provider",
          content: "New content",
          type: "note",
          metadata: {},
          provider: "s3vectors",
          providerTarget: JSON.stringify({
            bucketName: "vectors",
            indexName: "notes",
            region: "eu-west-2",
          }),
          embeddingModel: "@cf/baai/bge-large-en-v1.5",
          vectorSpace: "notes",
          vectorSpaceVersion: "v1",
        },
      ]),
    };

    const result = await queryEmbeddings({
      context: createContext(42, repository),
      request: { query: "private note" },
    });

    expect(provider.getQuery).toHaveBeenCalledTimes(2);
    expect(provider.getMatches).toHaveBeenCalledTimes(2);
    expect(result.data.map((match) => match.id)).toEqual(["old", "new"]);
    expect(result.data.every((match) => match.score === 1 / 61)).toBe(true);
  });

  it("cleans a retained pending write before retrying the same logical ID", async () => {
    provider.delete.mockResolvedValue({ status: "success", error: null });
    const repository = {
      activateDocument: vi.fn().mockResolvedValue(undefined),
      createDocument: vi.fn().mockResolvedValue(undefined),
      getPendingDocumentForRetry: vi.fn().mockResolvedValue({
        id: "pending-document",
        logicalId: "note-1",
        provider: "vectorize",
        providerTarget: "vectorize-binding",
        embeddingModel: "@cf/baai/bge-large-en-v1.5",
        vectorSpace: "default",
        vectorSpaceVersion: "v1",
        vectorIds: ["uncertain-vector"],
      }),
      removePendingDocument: vi.fn().mockResolvedValue(undefined),
    };

    await insertEmbedding({
      context: createContext(42, repository),
      request: { id: "note-1", type: "note", content: "Retry safely" },
    });

    expect(provider.delete).toHaveBeenCalledWith(["uncertain-vector"]);
    expect(repository.removePendingDocument).toHaveBeenCalledWith(42, "pending-document");
    expect(repository.createDocument).toHaveBeenCalledOnce();
    expect(repository.removePendingDocument.mock.invocationCallOrder[0]).toBeLessThan(
      repository.createDocument.mock.invocationCallOrder[0],
    );
  });

  it("releases quarantined legacy records without guessing a provider target", async () => {
    const repository = {
      activateDocument: vi.fn().mockResolvedValue(undefined),
      createDocument: vi.fn().mockResolvedValue(undefined),
      getPendingDocumentForRetry: vi.fn().mockResolvedValue({
        id: "legacy-document",
        logicalId: "note-1",
        provider: "quarantined",
        providerTarget: "quarantined-legacy",
        embeddingModel: "unknown-legacy",
        vectorSpace: "legacy-unresolved",
        vectorSpaceVersion: "legacy",
        vectorIds: ["legacy-vector"],
      }),
      removePendingDocument: vi.fn().mockResolvedValue(undefined),
    };

    await insertEmbedding({
      context: createContext(42, repository),
      request: { id: "note-1", type: "note", content: "Re-indexed safely" },
    });

    expect(provider.delete).not.toHaveBeenCalled();
    expect(repository.removePendingDocument).toHaveBeenCalledWith(42, "legacy-document");
    expect(repository.createDocument).toHaveBeenCalledOnce();
  });

  it("normalises provider and database errors before returning them to callers", async () => {
    const providerSentinel = "provider-response-secret";
    const databaseSentinel = "database-query-secret";

    provider.insert.mockRejectedValueOnce(
      new AssistantError(providerSentinel, ErrorType.PROVIDER_ERROR, 502),
    );
    const providerFailure = insertEmbedding({
      context: createContext(42, {
        activateDocument: vi.fn(),
        createDocument: vi.fn().mockResolvedValue(undefined),
        removePendingDocument: vi.fn().mockResolvedValue(undefined),
      }),
      request: { id: "note-provider", type: "note", content: "Private" },
    });

    await expect(providerFailure).rejects.toMatchObject({
      message: "Failed to insert embedding document",
      type: "PROVIDER_ERROR",
      statusCode: 502,
    });
    await expect(providerFailure).rejects.not.toMatchObject({ message: providerSentinel });

    provider.insert.mockResolvedValue({ status: "success", error: null });
    const databaseFailure = insertEmbedding({
      context: createContext(42, {
        activateDocument: vi.fn(),
        createDocument: vi
          .fn()
          .mockRejectedValue(new AssistantError(databaseSentinel, ErrorType.UNKNOWN_ERROR, 500)),
        removePendingDocument: vi.fn(),
      }),
      request: { id: "note-database", type: "note", content: "Private" },
    });

    await expect(databaseFailure).rejects.toMatchObject({
      message: "Failed to insert embedding document",
    });
    await expect(databaseFailure).rejects.not.toMatchObject({ message: databaseSentinel });
  });

  it("treats a committed activation with a lost response as success", async () => {
    const repository = {
      activateDocument: vi.fn().mockRejectedValue(new Error("response lost")),
      createDocument: vi.fn().mockResolvedValue(undefined),
      getDocumentLifecycleStatus: vi.fn().mockResolvedValue("active"),
      removePendingDocument: vi.fn(),
    };

    const result = await insertEmbedding({
      context: createContext(42, repository),
      request: { id: "note-1", type: "note", content: "Activated" },
    });

    expect(result.data.id).toBe("note-1");
    expect(provider.delete).not.toHaveBeenCalled();
    expect(repository.removePendingDocument).not.toHaveBeenCalled();
  });

  it("retains both authorities when activation status cannot be confirmed", async () => {
    const repository = {
      activateDocument: vi.fn().mockRejectedValue(new Error("response lost")),
      createDocument: vi.fn().mockResolvedValue(undefined),
      getDocumentLifecycleStatus: vi.fn().mockRejectedValue(new Error("read unavailable")),
      removePendingDocument: vi.fn(),
    };

    await expect(
      insertEmbedding({
        context: createContext(42, repository),
        request: { id: "note-1", type: "note", content: "Uncertain" },
      }),
    ).rejects.toMatchObject({ type: "PROVIDER_ERROR", statusCode: 502 });

    expect(provider.delete).not.toHaveBeenCalled();
    expect(repository.removePendingDocument).not.toHaveBeenCalled();
  });

  it("compensates a provider write when deletion wins the activation race", async () => {
    provider.delete.mockResolvedValue({ status: "success", error: null });
    const repository = {
      activateDocument: vi.fn().mockRejectedValue(new Error("lifecycle changed")),
      createDocument: vi.fn().mockResolvedValue(undefined),
      getDocumentLifecycleStatus: vi.fn().mockResolvedValue("delete_pending"),
      removePendingDocument: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      insertEmbedding({
        context: createContext(42, repository),
        request: { id: "note-1", type: "note", content: "Concurrent deletion" },
      }),
    ).rejects.toMatchObject({ type: "PROVIDER_ERROR", statusCode: 502 });

    expect(provider.delete).toHaveBeenCalledOnce();
    expect(repository.removePendingDocument).toHaveBeenCalledOnce();
  });

  it("preserves provider match order after scoped hydration", async () => {
    provider.getQuery.mockResolvedValue({ data: [[0.2]], status: { success: true } });
    provider.getMatches.mockResolvedValue({
      count: 2,
      matches: [
        { id: "vector-high", score: 0.95, metadata: {} },
        { id: "vector-low", score: 0.7, metadata: {} },
      ],
    });
    const repository = {
      getActiveChunksByVectorIds: vi.fn().mockResolvedValue([
        {
          vectorId: "vector-low",
          logicalId: "low",
          title: "Low",
          content: "Low result",
          type: "note",
          metadata: {},
          provider: "vectorize",
          providerTarget: "vectorize-binding",
          embeddingModel: "@cf/baai/bge-large-en-v1.5",
          vectorSpace: "default",
          vectorSpaceVersion: "v1",
        },
        {
          vectorId: "vector-high",
          logicalId: "high",
          title: "High",
          content: "High result",
          type: "note",
          metadata: {},
          provider: "vectorize",
          providerTarget: "vectorize-binding",
          embeddingModel: "@cf/baai/bge-large-en-v1.5",
          vectorSpace: "default",
          vectorSpaceVersion: "v1",
        },
      ]),
    };

    const result = await queryEmbeddings({
      context: createContext(42, repository),
      request: { query: "private note" },
    });

    expect(result.data.map((match) => match.id)).toEqual(["high", "low"]);
  });

  it("rejects a hydrated vector whose stored target differs from the queried target", async () => {
    provider.getQuery.mockResolvedValue({ data: [[0.2]], status: { success: true } });
    provider.getMatches.mockResolvedValue({
      count: 1,
      matches: [{ id: "shared-vector", score: 0.95, metadata: {} }],
    });
    const repository = {
      getActiveChunksByVectorIds: vi.fn().mockResolvedValue([
        {
          vectorId: "shared-vector",
          logicalId: "wrong-target",
          title: "Wrong target",
          content: "Must not hydrate",
          type: "note",
          metadata: {},
          provider: "s3vectors",
          providerTarget: JSON.stringify({
            bucketName: "vectors",
            indexName: "notes",
            region: "eu-west-2",
          }),
          embeddingModel: "@cf/baai/bge-large-en-v1.5",
          vectorSpace: "notes",
          vectorSpaceVersion: "v1",
        },
      ]),
    };

    await expect(
      queryEmbeddings({
        context: createContext(42, repository),
        request: { query: "private note" },
      }),
    ).resolves.toEqual({ status: "success", data: [] });
  });

  it("returns healthy historical targets when another target is unavailable", async () => {
    const s3Target = {
      provider: "s3vectors",
      providerTarget: JSON.stringify({
        bucketName: "vectors",
        indexName: "notes",
        region: "eu-west-2",
      }),
      embeddingModel: "@cf/baai/bge-large-en-v1.5",
      vectorSpace: "notes",
      vectorSpaceVersion: "v1",
    };

    provider.getQuery
      .mockRejectedValueOnce(new AssistantError("old target unavailable"))
      .mockResolvedValueOnce({ data: [[0.2]], status: { success: true } });
    provider.getMatches.mockResolvedValue({
      count: 1,
      matches: [{ id: "healthy-vector", score: 0.9, metadata: {} }],
    });
    const repository = {
      getActiveProviderTargets: vi.fn().mockResolvedValue([
        {
          provider: "vectorize",
          providerTarget: "vectorize-binding",
          embeddingModel: "@cf/baai/bge-large-en-v1.5",
          vectorSpace: "default",
          vectorSpaceVersion: "v1",
        },
        s3Target,
      ]),
      getActiveChunksByVectorIds: vi.fn().mockResolvedValue([
        {
          vectorId: "healthy-vector",
          logicalId: "healthy",
          title: "Healthy target",
          content: "Available",
          type: "note",
          metadata: {},
          ...s3Target,
        },
      ]),
    };

    const result = await queryEmbeddings({
      context: createContext(42, repository),
      request: { query: "private note" },
    });

    expect(result.data.map((match) => match.id)).toEqual(["healthy"]);
  });

  it("caps historical target fan-out before provider calls", async () => {
    const repository = {
      getActiveProviderTargets: vi.fn().mockResolvedValue(
        Array.from({ length: 9 }, (_, index) => ({
          provider: "vectorize",
          providerTarget: `vectorize-binding-${index}`,
          embeddingModel: "@cf/baai/bge-large-en-v1.5",
          vectorSpace: `space-${index}`,
          vectorSpaceVersion: "v1",
        })),
      ),
      getActiveChunksByVectorIds: vi.fn(),
    };

    await expect(
      queryEmbeddings({
        context: createContext(42, repository),
        request: { query: "private note" },
      }),
    ).rejects.toMatchObject({ type: "CONFIGURATION_ERROR", statusCode: 409 });

    expect(provider.getQuery).not.toHaveBeenCalled();
    expect(repository.getActiveProviderTargets).toHaveBeenCalledWith(42, 9);
  });

  it("returns a typed provider error when query encoding or vector search fails", async () => {
    const repository = {
      getActiveChunksByVectorIds: vi.fn(),
    };
    const context = createContext(42, repository);

    provider.getQuery.mockRejectedValueOnce(new Error("embedding model unavailable"));

    await expect(
      queryEmbeddings({ context, request: { query: "private note" } }),
    ).rejects.toMatchObject({ type: "PROVIDER_ERROR", statusCode: 502 });

    provider.getQuery.mockResolvedValue({ data: [[0.2]], status: { success: true } });
    provider.getMatches.mockRejectedValue(new Error("vector index unavailable"));

    await expect(
      queryEmbeddings({ context, request: { query: "private note" } }),
    ).rejects.toMatchObject({ type: "PROVIDER_ERROR", statusCode: 502 });

    expect(repository.getActiveChunksByVectorIds).not.toHaveBeenCalled();
  });

  it("normalises repository query errors before returning them to callers", async () => {
    const sentinel = "database-query-secret";
    const context = createContext(42, {
      getActiveProviderTargets: vi
        .fn()
        .mockRejectedValue(new AssistantError(sentinel, ErrorType.UNKNOWN_ERROR, 500)),
    });
    const operation = queryEmbeddings({ context, request: { query: "private note" } });

    await expect(operation).rejects.toMatchObject({
      message: "Unable to search embedding documents",
      type: "PROVIDER_ERROR",
      statusCode: 502,
    });
    await expect(operation).rejects.not.toMatchObject({ message: sentinel });
  });

  it("makes missing and foreign document deletion indistinguishable without provider mutation", async () => {
    const repository = {
      getDocumentsForDeletion: vi.fn().mockResolvedValue([]),
      markDocumentsDeletePending: vi.fn(),
      deleteDocuments: vi.fn(),
    };

    const result = await deleteEmbedding({
      context: createContext(42, repository),
      request: { ids: ["unknown-or-foreign"] },
    });

    expect(result).toEqual({
      status: "success",
      data: { ids: ["unknown-or-foreign"] },
    });
    expect(provider.delete).not.toHaveBeenCalled();
    expect(repository.markDocumentsDeletePending).not.toHaveBeenCalled();
    expect(repository.deleteDocuments).not.toHaveBeenCalled();
  });

  it("deletes owned documents in an idempotent batch containing missing identifiers", async () => {
    provider.delete.mockResolvedValue({ status: "success", error: null });
    const repository = {
      getDocumentsForDeletion: vi.fn().mockResolvedValue([
        {
          id: "document-1",
          logicalId: "owned",
          provider: "vectorize",
          providerTarget: "vectorize-binding",
          embeddingModel: "@cf/baai/bge-large-en-v1.5",
          vectorSpace: "default",
          vectorSpaceVersion: "v1",
          vectorIds: ["vector-1"],
        },
      ]),
      markDocumentsDeletePending: vi.fn(),
      deleteDocuments: vi.fn(),
    };

    const result = await deleteEmbedding({
      context: createContext(42, repository),
      request: { ids: ["owned", "missing-or-foreign"] },
    });

    expect(result).toEqual({
      status: "success",
      data: { ids: ["owned", "missing-or-foreign"] },
    });
    expect(provider.delete).toHaveBeenCalledWith(["vector-1"]);
    expect(repository.markDocumentsDeletePending).toHaveBeenCalledWith(42, ["document-1"]);
    expect(repository.deleteDocuments).toHaveBeenCalledWith(42, ["document-1"]);
  });

  it("deletes every recorded chunk before removing the scoped document", async () => {
    provider.delete.mockResolvedValue({ status: "success", error: null });
    const repository = {
      getDocumentsForDeletion: vi.fn().mockResolvedValue([
        {
          id: "document-1",
          logicalId: "note-1",
          provider: "vectorize",
          providerTarget: "vectorize-binding",
          embeddingModel: "@cf/baai/bge-large-en-v1.5",
          vectorSpace: "default",
          vectorSpaceVersion: "v1",
          vectorIds: ["vector-1", "vector-2"],
        },
      ]),
      markDocumentsDeletePending: vi.fn().mockResolvedValue(undefined),
      deleteDocuments: vi.fn().mockResolvedValue(undefined),
    };

    await deleteEmbedding({
      context: createContext(42, repository),
      request: { ids: ["note-1"] },
    });

    expect(repository.markDocumentsDeletePending).toHaveBeenCalledWith(42, ["document-1"]);
    expect(provider.delete).toHaveBeenCalledWith(["vector-1", "vector-2"]);
    expect(repository.deleteDocuments).toHaveBeenCalledWith(42, ["document-1"]);
  });

  it("keeps delete-pending state when provider deletion fails and completes on retry", async () => {
    provider.delete
      .mockResolvedValueOnce({ status: "error", error: "provider unavailable" })
      .mockResolvedValueOnce({ status: "success", error: null });
    const repository = {
      getDocumentsForDeletion: vi.fn().mockResolvedValue([
        {
          id: "document-1",
          logicalId: "note-1",
          provider: "vectorize",
          providerTarget: "vectorize-binding",
          embeddingModel: "@cf/baai/bge-large-en-v1.5",
          vectorSpace: "default",
          vectorSpaceVersion: "v1",
          vectorIds: ["vector-1"],
        },
      ]),
      markDocumentsDeletePending: vi.fn().mockResolvedValue(undefined),
      deleteDocuments: vi.fn(),
    };

    await expect(
      deleteEmbedding({
        context: createContext(42, repository),
        request: { ids: ["note-1"] },
      }),
    ).rejects.toMatchObject({ type: "PROVIDER_ERROR", statusCode: 502 });

    expect(repository.markDocumentsDeletePending).toHaveBeenCalledWith(42, ["document-1"]);
    expect(repository.deleteDocuments).not.toHaveBeenCalled();

    await expect(
      deleteEmbedding({
        context: createContext(42, repository),
        request: { ids: ["note-1"] },
      }),
    ).resolves.toEqual({ status: "success", data: { ids: ["note-1"] } });

    expect(provider.delete).toHaveBeenCalledTimes(2);
    expect(repository.markDocumentsDeletePending).toHaveBeenCalledTimes(2);
    expect(repository.deleteDocuments).toHaveBeenCalledWith(42, ["document-1"]);
  });
});
