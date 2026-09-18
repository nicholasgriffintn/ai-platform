import { describe, expect, it, vi } from "vitest";

import { EmbeddingRepository } from "../EmbeddingRepository";

describe("EmbeddingRepository", () => {
  it("creates one pending scoped document with all of its chunks", async () => {
    const statements: { params: unknown[]; query: string }[] = [];
    const batch = vi.fn().mockResolvedValue([{ meta: { changes: 1 } }, { meta: { changes: 2 } }]);
    const prepare = vi.fn((query: string) => ({
      bind: (...params: unknown[]) => {
        const statement = { params, query };

        statements.push(statement);

        return statement;
      },
    }));
    const repository = new EmbeddingRepository({ DB: { batch, prepare } } as any);

    await repository.createDocument({
      id: "document-internal",
      logicalId: "shared-logical-id",
      userId: 42,
      type: "note",
      title: "Scoped note",
      metadata: { tag: "private" },
      provider: "vectorize",
      providerTarget: "vectorize-binding",
      embeddingModel: "@cf/baai/bge-large-en-v1.5",
      embeddingDimensions: 1024,
      distanceMetric: "provider-configured",
      taskMode: "symmetric",
      vectorSpace: "default",
      vectorSpaceVersion: "v1",
      chunks: Array.from({ length: 128 }, (_, index) => ({
        id: `chunk-${index}`,
        vectorId: `vector-${index}`,
        index,
        content: `Chunk ${index}`,
      })),
    });

    expect(batch).toHaveBeenCalledOnce();
    expect(statements).toHaveLength(2);
    expect(statements[0]?.query).toContain("INSERT INTO embedding_document");
    expect(statements[0]?.params).toContain(42);
    expect(statements[0]?.params.slice(-3)).toEqual([1024, "provider-configured", "symmetric"]);
    expect(statements[1]?.query).toContain("FROM json_each(?)");
    expect(statements[1]?.params.slice(-4, -1)).toEqual([1024, "provider-configured", "symmetric"]);
    expect(JSON.parse(String(statements[1]?.params.at(-1)))).toHaveLength(128);
    expect(batch.mock.calls[0]?.[0]).toHaveLength(2);
  });

  it("hydrates matches only through active chunks in the authenticated personal scope", async () => {
    const calls: { params: unknown[]; query: string }[] = [];
    const prepare = vi.fn((query: string) => ({
      bind: (...params: unknown[]) => {
        calls.push({ params, query });

        return {
          all: vi.fn().mockResolvedValue({
            results: [
              {
                chunk_id: "chunk-1",
                chunk_index: 0,
                vector_id: "vector-1",
                logical_id: "note-1",
                title: "Private",
                content: "Authoritative content",
                type: "note",
                metadata: '{"tag":"trusted"}',
                provider: "vectorize",
                provider_target: "vectorize-binding",
                embedding_model: "@cf/baai/bge-large-en-v1.5",
                embedding_dimensions: 1024,
                distance_metric: "provider-configured",
                task_mode: "symmetric",
                vector_space: "default",
                vector_space_version: "v1",
              },
            ],
          }),
        };
      },
    }));
    const repository = new EmbeddingRepository({ DB: { prepare } } as any);

    const result = await repository.getActiveChunksByVectorIds(42, ["vector-1"], "note");

    expect(result).toEqual([
      {
        chunkId: "chunk-1",
        chunkIndex: 0,
        vectorId: "vector-1",
        logicalId: "note-1",
        title: "Private",
        content: "Authoritative content",
        type: "note",
        metadata: { tag: "trusted" },
        provider: "vectorize",
        providerTarget: "vectorize-binding",
        embeddingModel: "@cf/baai/bge-large-en-v1.5",
        embeddingDimensions: 1024,
        distanceMetric: "provider-configured",
        taskMode: "symmetric",
        vectorSpace: "default",
        vectorSpaceVersion: "v1",
      },
    ]);
    expect(calls[0]?.query).toContain("d.user_id = ?");
    expect(calls[0]?.query).toContain("d.lifecycle_status = 'active'");
    expect(calls[0]?.query).toContain("c.lifecycle_status = 'active'");
    expect(calls[0]?.query).toContain("c.id AS chunk_id");
    expect(calls[0]?.query).toContain("d.embedding_dimensions");
    expect(calls[0]?.params).toEqual([42, "note", "vector-1"]);
  });

  it("pages provider match hydration below the D1 parameter ceiling", async () => {
    const calls: { params: unknown[]; query: string }[] = [];
    const prepare = vi.fn((query: string) => ({
      bind: (...params: unknown[]) => {
        calls.push({ params, query });

        return { all: vi.fn().mockResolvedValue({ results: [] }) };
      },
    }));
    const repository = new EmbeddingRepository({ DB: { prepare } } as any);

    await repository.getActiveChunksByVectorIds(
      42,
      Array.from({ length: 100 }, (_, index) => `vector-${index}`),
      "note",
    );

    expect(calls).toHaveLength(2);
    expect(calls.every(({ params }) => params.length <= 100)).toBe(true);
  });

  it("lists immutable provider targets only for active personal documents", async () => {
    const calls: { params: unknown[]; query: string }[] = [];
    const prepare = vi.fn((query: string) => ({
      bind: (...params: unknown[]) => {
        calls.push({ params, query });

        return {
          all: vi.fn().mockResolvedValue({
            results: [
              {
                provider: "vectorize",
                provider_target: "vectorize-binding",
                embedding_model: "@cf/baai/bge-large-en-v1.5",
                embedding_dimensions: 1024,
                distance_metric: "provider-configured",
                task_mode: "symmetric",
                vector_space: "default",
                vector_space_version: "v1",
              },
            ],
          }),
        };
      },
    }));
    const repository = new EmbeddingRepository({ DB: { prepare } } as any);

    await expect(repository.getActiveProviderTargets(42)).resolves.toEqual([
      {
        provider: "vectorize",
        providerTarget: "vectorize-binding",
        embeddingModel: "@cf/baai/bge-large-en-v1.5",
        embeddingDimensions: 1024,
        distanceMetric: "provider-configured",
        taskMode: "symmetric",
        vectorSpace: "default",
        vectorSpaceVersion: "v1",
      },
    ]);
    expect(calls[0]?.query).toContain("SELECT DISTINCT provider");
    expect(calls[0]?.query).toContain("lifecycle_status = 'active'");
    expect(calls[0]?.params).toEqual([42]);
  });

  it("exposes retained pending documents for exact provider cleanup on retry", async () => {
    const prepare = vi.fn((query: string) => ({
      bind: (..._params: unknown[]) => ({
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: "document-1",
              logical_id: "note-1",
              provider: "vectorize",
              provider_target: "vectorize-binding",
              embedding_model: "@cf/baai/bge-large-en-v1.5",
              embedding_dimensions: 1024,
              distance_metric: "provider-configured",
              task_mode: "symmetric",
              vector_space: "default",
              vector_space_version: "v1",
              vector_id: "vector-1",
            },
          ],
        }),
        query,
      }),
    }));
    const repository = new EmbeddingRepository({ DB: { prepare } } as any);

    await expect(repository.getPendingDocumentForRetry(42, "note-1")).resolves.toEqual({
      id: "document-1",
      logicalId: "note-1",
      provider: "vectorize",
      providerTarget: "vectorize-binding",
      embeddingModel: "@cf/baai/bge-large-en-v1.5",
      embeddingDimensions: 1024,
      distanceMetric: "provider-configured",
      taskMode: "symmetric",
      vectorSpace: "default",
      vectorSpaceVersion: "v1",
      vectorIds: ["vector-1"],
    });
    expect(prepare.mock.calls[0]?.[0]).toContain("lifecycle_status = 'pending'");
  });

  it("activates a personal document and its chunks together", async () => {
    const statements: { params: unknown[]; query: string }[] = [];
    const batch = vi.fn().mockResolvedValue([{ meta: { changes: 1 } }, { meta: { changes: 2 } }]);
    const prepare = vi.fn((query: string) => ({
      bind: (...params: unknown[]) => {
        const statement = { params, query };

        statements.push(statement);

        return statement;
      },
    }));
    const repository = new EmbeddingRepository({ DB: { batch, prepare } } as any);

    await repository.activateDocument(42, "document-1");

    expect(batch).toHaveBeenCalledOnce();
    expect(statements).toHaveLength(2);
    expect(statements[0]?.query).toContain("UPDATE embedding_document");
    expect(statements[0]?.query).toContain("user_id = ?");
    expect(statements[0]?.params).toEqual([42, "document-1"]);
    expect(statements[1]?.query).toContain("UPDATE embedding_chunk");
  });

  it("rejects activation when the pending lifecycle changed concurrently", async () => {
    const batch = vi.fn().mockResolvedValue([{ meta: { changes: 0 } }, { meta: { changes: 0 } }]);
    const prepare = vi.fn((query: string) => ({
      bind: (...params: unknown[]) => ({ params, query }),
    }));
    const repository = new EmbeddingRepository({ DB: { batch, prepare } } as any);

    await expect(repository.activateDocument(42, "document-1")).rejects.toMatchObject({
      type: "CONFLICT_ERROR",
      statusCode: 409,
    });
  });

  it("resolves deletion targets by logical ID only within the personal scope", async () => {
    const calls: { params: unknown[]; query: string }[] = [];
    const prepare = vi.fn((query: string) => ({
      bind: (...params: unknown[]) => {
        calls.push({ params, query });

        return {
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: "document-1",
                logical_id: "note-1",
                provider: "vectorize",
                provider_target: "vectorize-binding",
                embedding_model: "@cf/baai/bge-large-en-v1.5",
                embedding_dimensions: 1024,
                distance_metric: "provider-configured",
                task_mode: "symmetric",
                vector_space: "default",
                vector_space_version: "v1",
                vector_id: "vector-1",
              },
              {
                id: "document-1",
                logical_id: "note-1",
                provider: "vectorize",
                provider_target: "vectorize-binding",
                embedding_model: "@cf/baai/bge-large-en-v1.5",
                embedding_dimensions: 1024,
                distance_metric: "provider-configured",
                task_mode: "symmetric",
                vector_space: "default",
                vector_space_version: "v1",
                vector_id: "vector-2",
              },
            ],
          }),
        };
      },
    }));
    const repository = new EmbeddingRepository({ DB: { prepare } } as any);

    const result = await repository.getDocumentsForDeletion(42, ["note-1"]);

    expect(result).toEqual([
      {
        id: "document-1",
        logicalId: "note-1",
        provider: "vectorize",
        providerTarget: "vectorize-binding",
        embeddingModel: "@cf/baai/bge-large-en-v1.5",
        embeddingDimensions: 1024,
        distanceMetric: "provider-configured",
        taskMode: "symmetric",
        vectorSpace: "default",
        vectorSpaceVersion: "v1",
        vectorIds: ["vector-1", "vector-2"],
      },
    ]);
    expect(calls[0]?.query).toContain("d.user_id = ?");
    expect(calls[0]?.params).toEqual([42, "note-1"]);
  });

  it("pages exactly 100 deletion IDs below the D1 parameter ceiling", async () => {
    const calls: { params: unknown[]; query: string }[] = [];
    const prepare = vi.fn((query: string) => ({
      bind: (...params: unknown[]) => {
        calls.push({ params, query });

        return { all: vi.fn().mockResolvedValue({ results: [] }) };
      },
    }));
    const repository = new EmbeddingRepository({ DB: { prepare } } as any);

    await repository.getDocumentsForDeletion(
      42,
      Array.from({ length: 100 }, (_, index) => `document-${index}`),
    );

    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.params.length <= 99)).toBe(true);
  });

  it("does not fall back from an explicitly scoped legacy lookup", async () => {
    const first = vi.fn().mockResolvedValueOnce({
      id: "embedding-1",
      namespace: "user_kb_42",
      user_id: 42,
    });
    const bind = vi.fn((..._values: unknown[]) => ({ first }));
    const prepare = vi.fn((_query: string) => ({ bind }));

    const repository = new EmbeddingRepository({
      DB: { prepare },
    } as any);

    const result = await repository.getEmbedding("embedding-1", {
      type: "note",
      namespace: "user_kb_42",
      userId: 42,
    });

    expect(result).toEqual({
      id: "embedding-1",
      namespace: "user_kb_42",
      user_id: 42,
    });
    expect(prepare).toHaveBeenCalledOnce();
    expect(prepare.mock.calls[0][0]).toContain("namespace = ?");
    expect(prepare.mock.calls[0][0]).toContain("user_id = ?");
    expect(bind.mock.calls[0]).toEqual(["embedding-1", "note", "user_kb_42", 42]);
  });

  it("splits a large insert into multiple batches so no single batch exceeds the statement cap", async () => {
    const batch = vi.fn().mockResolvedValue(undefined);
    const bind = vi.fn(() => ({}));
    const prepare = vi.fn(() => ({ bind }));

    const repository = new EmbeddingRepository({
      DB: { prepare, batch },
    } as any);

    const records = [
      { id: "embedding-0", metadata: {}, title: "T0", content: "C0", type: "note" },
      { id: "embedding-1", metadata: {}, title: "T1", content: "C1", type: "note" },
      { id: "embedding-2", metadata: {}, title: "T2", content: "C2", type: "note" },
      { id: "embedding-3", metadata: {}, title: "T3", content: "C3", type: "note" },
      { id: "embedding-4", metadata: {}, title: "T4", content: "C4", type: "note" },
      { id: "embedding-5", metadata: {}, title: "T5", content: "C5", type: "note" },
      { id: "embedding-6", metadata: {}, title: "T6", content: "C6", type: "note" },
      { id: "embedding-7", metadata: {}, title: "T7", content: "C7", type: "note" },
      { id: "embedding-8", metadata: {}, title: "T8", content: "C8", type: "note" },
      { id: "embedding-9", metadata: {}, title: "T9", content: "C9", type: "note" },
      { id: "embedding-10", metadata: {}, title: "T10", content: "C10", type: "note" },
      { id: "embedding-11", metadata: {}, title: "T11", content: "C11", type: "note" },
      { id: "embedding-12", metadata: {}, title: "T12", content: "C12", type: "note" },
      { id: "embedding-13", metadata: {}, title: "T13", content: "C13", type: "note" },
      { id: "embedding-14", metadata: {}, title: "T14", content: "C14", type: "note" },
      { id: "embedding-15", metadata: {}, title: "T15", content: "C15", type: "note" },
      { id: "embedding-16", metadata: {}, title: "T16", content: "C16", type: "note" },
      { id: "embedding-17", metadata: {}, title: "T17", content: "C17", type: "note" },
      { id: "embedding-18", metadata: {}, title: "T18", content: "C18", type: "note" },
      { id: "embedding-19", metadata: {}, title: "T19", content: "C19", type: "note" },
      { id: "embedding-20", metadata: {}, title: "T20", content: "C20", type: "note" },
      { id: "embedding-21", metadata: {}, title: "T21", content: "C21", type: "note" },
      { id: "embedding-22", metadata: {}, title: "T22", content: "C22", type: "note" },
      { id: "embedding-23", metadata: {}, title: "T23", content: "C23", type: "note" },
      { id: "embedding-24", metadata: {}, title: "T24", content: "C24", type: "note" },
      { id: "embedding-25", metadata: {}, title: "T25", content: "C25", type: "note" },
      { id: "embedding-26", metadata: {}, title: "T26", content: "C26", type: "note" },
      { id: "embedding-27", metadata: {}, title: "T27", content: "C27", type: "note" },
      { id: "embedding-28", metadata: {}, title: "T28", content: "C28", type: "note" },
      { id: "embedding-29", metadata: {}, title: "T29", content: "C29", type: "note" },
      { id: "embedding-30", metadata: {}, title: "T30", content: "C30", type: "note" },
      { id: "embedding-31", metadata: {}, title: "T31", content: "C31", type: "note" },
      { id: "embedding-32", metadata: {}, title: "T32", content: "C32", type: "note" },
      { id: "embedding-33", metadata: {}, title: "T33", content: "C33", type: "note" },
      { id: "embedding-34", metadata: {}, title: "T34", content: "C34", type: "note" },
      { id: "embedding-35", metadata: {}, title: "T35", content: "C35", type: "note" },
      { id: "embedding-36", metadata: {}, title: "T36", content: "C36", type: "note" },
      { id: "embedding-37", metadata: {}, title: "T37", content: "C37", type: "note" },
      { id: "embedding-38", metadata: {}, title: "T38", content: "C38", type: "note" },
      { id: "embedding-39", metadata: {}, title: "T39", content: "C39", type: "note" },
      { id: "embedding-40", metadata: {}, title: "T40", content: "C40", type: "note" },
      { id: "embedding-41", metadata: {}, title: "T41", content: "C41", type: "note" },
      { id: "embedding-42", metadata: {}, title: "T42", content: "C42", type: "note" },
      { id: "embedding-43", metadata: {}, title: "T43", content: "C43", type: "note" },
      { id: "embedding-44", metadata: {}, title: "T44", content: "C44", type: "note" },
      { id: "embedding-45", metadata: {}, title: "T45", content: "C45", type: "note" },
      { id: "embedding-46", metadata: {}, title: "T46", content: "C46", type: "note" },
      { id: "embedding-47", metadata: {}, title: "T47", content: "C47", type: "note" },
      { id: "embedding-48", metadata: {}, title: "T48", content: "C48", type: "note" },
      { id: "embedding-49", metadata: {}, title: "T49", content: "C49", type: "note" },
      { id: "embedding-50", metadata: {}, title: "T50", content: "C50", type: "note" },
      { id: "embedding-51", metadata: {}, title: "T51", content: "C51", type: "note" },
      { id: "embedding-52", metadata: {}, title: "T52", content: "C52", type: "note" },
      { id: "embedding-53", metadata: {}, title: "T53", content: "C53", type: "note" },
      { id: "embedding-54", metadata: {}, title: "T54", content: "C54", type: "note" },
      { id: "embedding-55", metadata: {}, title: "T55", content: "C55", type: "note" },
      { id: "embedding-56", metadata: {}, title: "T56", content: "C56", type: "note" },
      { id: "embedding-57", metadata: {}, title: "T57", content: "C57", type: "note" },
      { id: "embedding-58", metadata: {}, title: "T58", content: "C58", type: "note" },
      { id: "embedding-59", metadata: {}, title: "T59", content: "C59", type: "note" },
      { id: "embedding-60", metadata: {}, title: "T60", content: "C60", type: "note" },
      { id: "embedding-61", metadata: {}, title: "T61", content: "C61", type: "note" },
      { id: "embedding-62", metadata: {}, title: "T62", content: "C62", type: "note" },
      { id: "embedding-63", metadata: {}, title: "T63", content: "C63", type: "note" },
      { id: "embedding-64", metadata: {}, title: "T64", content: "C64", type: "note" },
      { id: "embedding-65", metadata: {}, title: "T65", content: "C65", type: "note" },
      { id: "embedding-66", metadata: {}, title: "T66", content: "C66", type: "note" },
      { id: "embedding-67", metadata: {}, title: "T67", content: "C67", type: "note" },
      { id: "embedding-68", metadata: {}, title: "T68", content: "C68", type: "note" },
      { id: "embedding-69", metadata: {}, title: "T69", content: "C69", type: "note" },
      { id: "embedding-70", metadata: {}, title: "T70", content: "C70", type: "note" },
      { id: "embedding-71", metadata: {}, title: "T71", content: "C71", type: "note" },
      { id: "embedding-72", metadata: {}, title: "T72", content: "C72", type: "note" },
      { id: "embedding-73", metadata: {}, title: "T73", content: "C73", type: "note" },
      { id: "embedding-74", metadata: {}, title: "T74", content: "C74", type: "note" },
      { id: "embedding-75", metadata: {}, title: "T75", content: "C75", type: "note" },
      { id: "embedding-76", metadata: {}, title: "T76", content: "C76", type: "note" },
      { id: "embedding-77", metadata: {}, title: "T77", content: "C77", type: "note" },
      { id: "embedding-78", metadata: {}, title: "T78", content: "C78", type: "note" },
      { id: "embedding-79", metadata: {}, title: "T79", content: "C79", type: "note" },
      { id: "embedding-80", metadata: {}, title: "T80", content: "C80", type: "note" },
      { id: "embedding-81", metadata: {}, title: "T81", content: "C81", type: "note" },
      { id: "embedding-82", metadata: {}, title: "T82", content: "C82", type: "note" },
      { id: "embedding-83", metadata: {}, title: "T83", content: "C83", type: "note" },
      { id: "embedding-84", metadata: {}, title: "T84", content: "C84", type: "note" },
      { id: "embedding-85", metadata: {}, title: "T85", content: "C85", type: "note" },
      { id: "embedding-86", metadata: {}, title: "T86", content: "C86", type: "note" },
      { id: "embedding-87", metadata: {}, title: "T87", content: "C87", type: "note" },
      { id: "embedding-88", metadata: {}, title: "T88", content: "C88", type: "note" },
      { id: "embedding-89", metadata: {}, title: "T89", content: "C89", type: "note" },
      { id: "embedding-90", metadata: {}, title: "T90", content: "C90", type: "note" },
      { id: "embedding-91", metadata: {}, title: "T91", content: "C91", type: "note" },
      { id: "embedding-92", metadata: {}, title: "T92", content: "C92", type: "note" },
      { id: "embedding-93", metadata: {}, title: "T93", content: "C93", type: "note" },
      { id: "embedding-94", metadata: {}, title: "T94", content: "C94", type: "note" },
      { id: "embedding-95", metadata: {}, title: "T95", content: "C95", type: "note" },
      { id: "embedding-96", metadata: {}, title: "T96", content: "C96", type: "note" },
      { id: "embedding-97", metadata: {}, title: "T97", content: "C97", type: "note" },
      { id: "embedding-98", metadata: {}, title: "T98", content: "C98", type: "note" },
      { id: "embedding-99", metadata: {}, title: "T99", content: "C99", type: "note" },
      { id: "embedding-100", metadata: {}, title: "T100", content: "C100", type: "note" },
      { id: "embedding-101", metadata: {}, title: "T101", content: "C101", type: "note" },
      { id: "embedding-102", metadata: {}, title: "T102", content: "C102", type: "note" },
      { id: "embedding-103", metadata: {}, title: "T103", content: "C103", type: "note" },
      { id: "embedding-104", metadata: {}, title: "T104", content: "C104", type: "note" },
      { id: "embedding-105", metadata: {}, title: "T105", content: "C105", type: "note" },
      { id: "embedding-106", metadata: {}, title: "T106", content: "C106", type: "note" },
      { id: "embedding-107", metadata: {}, title: "T107", content: "C107", type: "note" },
      { id: "embedding-108", metadata: {}, title: "T108", content: "C108", type: "note" },
      { id: "embedding-109", metadata: {}, title: "T109", content: "C109", type: "note" },
      { id: "embedding-110", metadata: {}, title: "T110", content: "C110", type: "note" },
      { id: "embedding-111", metadata: {}, title: "T111", content: "C111", type: "note" },
      { id: "embedding-112", metadata: {}, title: "T112", content: "C112", type: "note" },
      { id: "embedding-113", metadata: {}, title: "T113", content: "C113", type: "note" },
      { id: "embedding-114", metadata: {}, title: "T114", content: "C114", type: "note" },
      { id: "embedding-115", metadata: {}, title: "T115", content: "C115", type: "note" },
      { id: "embedding-116", metadata: {}, title: "T116", content: "C116", type: "note" },
      { id: "embedding-117", metadata: {}, title: "T117", content: "C117", type: "note" },
      { id: "embedding-118", metadata: {}, title: "T118", content: "C118", type: "note" },
      { id: "embedding-119", metadata: {}, title: "T119", content: "C119", type: "note" },
    ];

    await repository.insertEmbeddings(records, { namespace: "user_kb_42", userId: 42 });

    // 120 records at 50 per batch means 3 batches: 50, 50, 20.
    expect(batch).toHaveBeenCalledTimes(3);
    expect(batch.mock.calls[0][0]).toHaveLength(50);
    expect(batch.mock.calls[1][0]).toHaveLength(50);
    expect(batch.mock.calls[2][0]).toHaveLength(20);
  });

  it("rolls back only the batches that were already committed when a later batch fails", async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    const bind = vi.fn((..._args: unknown[]) => ({ run }));
    const prepare = vi.fn(() => ({ bind }));
    const batch = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("d1 batch failed"));

    const repository = new EmbeddingRepository({
      DB: { prepare, batch },
    } as any);

    const records = Array.from({ length: 120 }, (_, i) => ({
      id: `embedding-${i}`,
      metadata: {},
      title: `T${i}`,
      content: `C${i}`,
      type: "note",
    }));

    await expect(
      repository.insertEmbeddings(records, { namespace: "user_kb_42", userId: 42 }),
    ).rejects.toThrow("d1 batch failed");

    // The first 100 committed IDs are compensated in pages of 98 and 2, leaving room for
    // the user and namespace parameters in D1's 100-parameter ceiling.
    expect(run).toHaveBeenCalledTimes(2);
    const deleteCalls = bind.mock.calls.filter((call) => call[0] === 42);

    expect(deleteCalls.map((call) => call.length)).toEqual([100, 4]);
    expect(deleteCalls.every((call) => call.length <= 100)).toBe(true);
  });
});
