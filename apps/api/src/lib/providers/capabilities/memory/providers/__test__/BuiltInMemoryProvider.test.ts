import { beforeEach, describe, expect, it, vi } from "vitest";

const vectorizeTarget = {
  provider: "vectorize",
  target: "vectorize-binding",
  model: "@cf/baai/bge-large-en-v1.5",
  vectorSpace: "default",
  vectorSpaceVersion: "v1",
};
const s3Target = {
  provider: "s3vectors",
  target: JSON.stringify({
    bucketName: "memory-bucket",
    indexName: "memory-index",
    region: "eu-west-1",
  }),
  model: "@cf/baai/bge-large-en-v1.5",
  vectorSpace: "memory-index",
  vectorSpaceVersion: "v1",
};
const mocks = vi.hoisted(() => {
  // Vitest must construct these providers inside its hoisted mock initialiser.
  // oxlint-disable-next-line unicorn/consistent-function-scoping
  const createProvider = () => ({
    delete: vi.fn().mockResolvedValue({ status: "success", error: null }),
    generate: vi
      .fn()
      .mockImplementation(async (_type: string, _text: string, id: string) => [
        { id, values: [0.1], metadata: { type: "memory" } },
      ]),
    getMatches: vi.fn().mockResolvedValue({ count: 0, matches: [] }),
    getQuery: vi.fn().mockResolvedValue({ data: [[0.1]], status: { success: true } }),
    insert: vi.fn().mockResolvedValue({ status: "success", error: null }),
  });

  return {
    vectorize: createProvider(),
    s3: createProvider(),
    getEmbeddingProvider: vi.fn(),
    getEmbeddingProviderForTarget: vi.fn(),
    resolveEmbeddingProviderTarget: vi.fn(),
  };
});

vi.mock("~/lib/providers/capabilities/embedding/helpers", () => ({
  getEmbeddingProvider: mocks.getEmbeddingProvider,
  getEmbeddingProviderForTarget: mocks.getEmbeddingProviderForTarget,
  resolveEmbeddingProviderTarget: mocks.resolveEmbeddingProviderTarget,
}));
vi.mock("~/lib/providers/library", () => ({ providerLibrary: {} }));
vi.mock("~/lib/providers/lib/fetch", () => ({ fetchProviderJson: vi.fn() }));
vi.mock("~/services/apps/connectors", () => ({
  getRecipeConnectorAccessToken: vi.fn(),
}));
vi.mock("~/repositories/SourceRepository", () => ({
  SourceRepository: vi.fn(),
}));

import { BuiltInMemoryProvider } from "../BuiltInMemoryProvider";

const env = {
  EMBEDDING_SCOPE_SECRET: "test-memory-scope-secret-at-least-32-chars",
} as any;
const user = { id: 42 } as any;

const settings = (embeddingProvider: "vectorize" | "s3vectors") =>
  ({
    embedding_provider: embeddingProvider,
    s3vectors_bucket_name: "memory-bucket",
    s3vectors_index_name: "memory-index",
    s3vectors_region: "eu-west-1",
  }) as any;

const source = (input: {
  id: string;
  vectorId: string;
  content?: string;
  status?: "available" | "processing" | "archived";
  target?: typeof vectorizeTarget | typeof s3Target | null;
}) =>
  ({
    id: input.id,
    content: input.content ?? input.id,
    created_by_user_id: 42,
    project_id: null,
    kind: "memory",
    status: input.status ?? "available",
    vector_id: input.vectorId,
    metadata: JSON.stringify({
      authority: input.id,
      ...(input.target === undefined
        ? { embedding_provider_target: vectorizeTarget }
        : input.target
          ? { embedding_provider_target: input.target }
          : {}),
    }),
  }) as any;

const repository = (sources: any[] = []) => ({
  createSource: vi.fn().mockResolvedValue({ id: "memory-new" }),
  deleteSource: vi.fn().mockResolvedValue(undefined),
  getSource: vi.fn(),
  getSourceByVectorId: vi.fn(async (vectorId: string) =>
    sources.find((entry) => entry.vector_id === vectorId),
  ),
  listPersonalSources: vi.fn().mockResolvedValue(sources),
  listProjectSources: vi.fn().mockResolvedValue(sources),
  removeSourceFromCollections: vi.fn().mockResolvedValue(undefined),
  transitionSourceStatus: vi.fn().mockResolvedValue(true),
  updateSource: vi.fn().mockResolvedValue(undefined),
});

const createProvider = (repo: ReturnType<typeof repository>, provider = "vectorize") =>
  new BuiltInMemoryProvider(env, user, settings(provider as "vectorize" | "s3vectors"), {
    repositories: { sources: repo },
  } as any);

describe("built-in memory embedding provenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.vectorize.delete.mockResolvedValue({ status: "success", error: null });
    mocks.vectorize.generate.mockImplementation(async (_type, _text, id) => [
      { id, values: [0.1], metadata: { type: "memory" } },
    ]);
    mocks.vectorize.getMatches.mockResolvedValue({ count: 0, matches: [] });
    mocks.vectorize.getQuery.mockResolvedValue({
      data: [[0.1]],
      status: { success: true },
    });
    mocks.vectorize.insert.mockResolvedValue({ status: "success", error: null });
    mocks.s3.delete.mockResolvedValue({ status: "success", error: null });
    mocks.s3.generate.mockImplementation(async (_type, _text, id) => [
      { id, values: [0.1], metadata: { type: "memory" } },
    ]);
    mocks.s3.getMatches.mockResolvedValue({ count: 0, matches: [] });
    mocks.s3.getQuery.mockResolvedValue({ data: [[0.1]], status: { success: true } });
    mocks.s3.insert.mockResolvedValue({ status: "success", error: null });
    mocks.getEmbeddingProvider.mockReturnValue(mocks.vectorize);
    mocks.resolveEmbeddingProviderTarget.mockImplementation(
      async (_env, _user, userSettings: { embedding_provider: string }) =>
        userSettings.embedding_provider === "s3vectors" ? s3Target : vectorizeTarget,
    );
    mocks.getEmbeddingProviderForTarget.mockImplementation(
      (_env, _user, _settings, target: { provider: string }) =>
        target.provider === "s3vectors" ? mocks.s3 : mocks.vectorize,
    );
  });

  it("retrieves and ranks D1-authorised memories across stored targets after a switch", async () => {
    const sources = [
      source({ id: "vectorize-memory", vectorId: "vectorize-vector", target: vectorizeTarget }),
      source({ id: "s3-memory", vectorId: "s3-vector", target: s3Target }),
      source({ id: "legacy-memory", vectorId: "legacy-vector", target: null }),
      source({
        id: "processing-memory",
        vectorId: "processing-vector",
        status: "processing",
        target: vectorizeTarget,
      }),
    ];

    mocks.vectorize.getMatches.mockResolvedValue({
      count: 3,
      matches: [
        { id: "vectorize-vector", score: 0.8, metadata: { content: "poison" } },
        { id: "s3-vector", score: 0.99, metadata: { content: "wrong target" } },
        { id: "processing-vector", score: 0.98, metadata: {} },
      ],
    });
    mocks.s3.getMatches.mockResolvedValue({
      count: 2,
      matches: [
        { id: "s3-vector", score: 0.9, metadata: {} },
        { id: "legacy-vector", score: 0.7, metadata: {} },
      ],
    });

    const result = await createProvider(repository(sources), "s3vectors").retrieveMemories(
      "remember",
      { topK: 5 },
    );

    expect(result).toEqual([
      {
        id: "vectorize-memory",
        text: "vectorize-memory",
        score: 1 / 61,
        metadata: { authority: "vectorize-memory" },
      },
      {
        id: "s3-memory",
        text: "s3-memory",
        score: 1 / 61,
        metadata: { authority: "s3-memory" },
      },
    ]);
    expect(mocks.getEmbeddingProviderForTarget).toHaveBeenCalledWith(
      env,
      user,
      expect.any(Object),
      vectorizeTarget,
    );
    expect(mocks.getEmbeddingProviderForTarget).toHaveBeenCalledWith(
      env,
      user,
      expect.any(Object),
      s3Target,
    );
    expect(mocks.vectorize.getMatches).toHaveBeenCalledWith(
      expect.any(Float64Array),
      expect.objectContaining({ scopeTag: expect.stringMatching(/^scope_v1_[a-f0-9]{32}$/) }),
    );
  });

  it("deduplicates a new S3 memory against an active memory in the old Vectorize target", async () => {
    const oldMemory = source({
      id: "old-memory",
      vectorId: "old-vector",
      target: vectorizeTarget,
    });
    const repo = repository([oldMemory]);

    mocks.vectorize.getMatches.mockResolvedValue({
      count: 1,
      matches: [{ id: "old-vector", score: 0.91, metadata: {} }],
    });

    await expect(
      createProvider(repo, "s3vectors").storeMemory({ text: "Duplicate", metadata: {} }),
    ).resolves.toEqual({ id: null, provider: "built-in" });

    expect(mocks.s3.generate).toHaveBeenCalled();
    expect(mocks.vectorize.getQuery).toHaveBeenCalledWith("Duplicate");
    expect(mocks.s3.insert).not.toHaveBeenCalled();
    expect(repo.createSource).not.toHaveBeenCalled();
  });

  it("persists the immutable target after user metadata and activates only after insert", async () => {
    const repo = repository();

    await createProvider(repo, "s3vectors").storeMemory({
      text: "Remember this",
      metadata: { embedding_provider_target: "attacker-controlled-target" },
    });

    expect(repo.createSource).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "processing",
        metadata: expect.objectContaining({ embedding_provider_target: s3Target }),
      }),
    );
    expect(mocks.s3.insert).toHaveBeenCalled();
    expect(repo.transitionSourceStatus).toHaveBeenCalledWith(
      "memory-new",
      ["processing"],
      "available",
    );
  });

  it("treats a committed activation with a lost response as success", async () => {
    const repo = repository();

    repo.transitionSourceStatus.mockRejectedValue(new Error("response lost"));
    repo.getSource.mockResolvedValue(
      source({
        id: "memory-new",
        vectorId: "new-vector",
        status: "available",
        target: vectorizeTarget,
      }),
    );

    await expect(
      createProvider(repo).storeMemory({ text: "Remember this", metadata: {} }),
    ).resolves.toMatchObject({ id: "memory-new", provider: "built-in" });

    expect(mocks.vectorize.delete).not.toHaveBeenCalled();
    expect(repo.deleteSource).not.toHaveBeenCalled();
  });

  it("compensates a confirmed processing source when activation fails", async () => {
    const repo = repository();

    repo.transitionSourceStatus.mockRejectedValue(new Error("activation failed"));
    repo.getSource.mockResolvedValue(
      source({
        id: "memory-new",
        vectorId: "new-vector",
        status: "processing",
        target: vectorizeTarget,
      }),
    );

    await expect(
      createProvider(repo).storeMemory({ text: "Remember this", metadata: {} }),
    ).rejects.toMatchObject({
      message: "Unable to confirm memory activation",
      type: "DATABASE_ERROR",
    });

    expect(mocks.vectorize.delete).toHaveBeenCalledOnce();
    expect(repo.deleteSource).toHaveBeenCalledWith("memory-new");
  });

  it("does not reactivate a memory archived during provider insertion", async () => {
    const repo = repository();

    repo.transitionSourceStatus.mockResolvedValue(false);
    repo.getSource.mockResolvedValue(
      source({
        id: "memory-new",
        vectorId: "new-vector",
        status: "archived",
        target: vectorizeTarget,
      }),
    );

    await expect(
      createProvider(repo).storeMemory({ text: "Remember this", metadata: {} }),
    ).rejects.toMatchObject({
      message: "Unable to confirm memory activation",
      type: "DATABASE_ERROR",
    });

    expect(mocks.vectorize.delete).toHaveBeenCalledWith([expect.any(String)]);
    expect(repo.deleteSource).toHaveBeenCalledWith("memory-new");
  });

  it("retains both authorities when memory activation cannot be confirmed", async () => {
    const repo = repository();

    repo.transitionSourceStatus.mockRejectedValue(new Error("response lost"));
    repo.getSource.mockRejectedValue(new Error("read unavailable"));

    await expect(
      createProvider(repo).storeMemory({ text: "Remember this", metadata: {} }),
    ).rejects.toMatchObject({
      message: "Unable to confirm memory activation",
      type: "DATABASE_ERROR",
    });

    expect(mocks.vectorize.delete).not.toHaveBeenCalled();
    expect(repo.deleteSource).not.toHaveBeenCalled();
  });

  it("removes a processing source only after uncertain insert cleanup is confirmed", async () => {
    const repo = repository();

    mocks.vectorize.insert.mockRejectedValue(new Error("provider timeout"));

    await expect(
      createProvider(repo).storeMemory({ text: "Remember this", metadata: {} }),
    ).rejects.toMatchObject({
      message: "Unable to access memory embeddings",
      type: "PROVIDER_ERROR",
    });

    expect(mocks.vectorize.delete).toHaveBeenCalledOnce();
    expect(repo.deleteSource).toHaveBeenCalledWith("memory-new");
  });

  it.each([
    {
      name: "returns an error",
      failCleanup: () =>
        mocks.vectorize.delete.mockResolvedValue({ status: "error", error: "unavailable" }),
    },
    {
      name: "throws",
      failCleanup: () => mocks.vectorize.delete.mockRejectedValue(new Error("unavailable")),
    },
  ])("retains a processing source when uncertain insert cleanup $name", async ({ failCleanup }) => {
    const repo = repository();

    mocks.vectorize.insert.mockRejectedValue(new Error("provider timeout"));
    failCleanup();

    await expect(
      createProvider(repo).storeMemory({ text: "Remember this", metadata: {} }),
    ).rejects.toMatchObject({ type: "PROVIDER_ERROR" });

    expect(repo.removeSourceFromCollections).not.toHaveBeenCalled();
    expect(repo.deleteSource).not.toHaveBeenCalled();
  });

  it("deletes from the stored Vectorize target after the current provider switches to S3", async () => {
    const memory = source({
      id: "old-memory",
      vectorId: "old-vector",
      target: vectorizeTarget,
    });
    const repo = repository();

    repo.getSource.mockResolvedValue(memory);

    await expect(createProvider(repo, "s3vectors").deleteMemory("old-memory")).resolves.toBe(true);

    expect(mocks.getEmbeddingProviderForTarget).toHaveBeenCalledWith(
      env,
      user,
      expect.any(Object),
      vectorizeTarget,
    );
    expect(mocks.vectorize.delete).toHaveBeenCalledWith(["old-vector"]);
    expect(mocks.s3.delete).not.toHaveBeenCalled();
    expect(repo.transitionSourceStatus).toHaveBeenCalledWith(
      "old-memory",
      ["processing", "available", "archived"],
      "archived",
    );
    expect(repo.deleteSource).toHaveBeenCalledWith("old-memory");
  });

  it("archives a targetless legacy source without guessing a provider", async () => {
    const legacy = source({ id: "legacy-memory", vectorId: "legacy-vector", target: null });
    const repo = repository();

    repo.getSource.mockResolvedValue(legacy);

    await expect(createProvider(repo, "s3vectors").deleteMemory("legacy-memory")).resolves.toBe(
      false,
    );

    expect(mocks.s3.delete).not.toHaveBeenCalled();
    expect(mocks.vectorize.delete).not.toHaveBeenCalled();
    expect(repo.transitionSourceStatus).toHaveBeenCalledWith(
      "legacy-memory",
      ["processing", "available", "archived"],
      "archived",
    );
    expect(repo.deleteSource).not.toHaveBeenCalled();
  });

  it("retains an archived source when provider deletion is not confirmed", async () => {
    const memory = source({ id: "memory-1", vectorId: "vector-1", target: vectorizeTarget });
    const repo = repository();

    repo.getSource.mockResolvedValue(memory);
    mocks.vectorize.delete.mockResolvedValue({ status: "error", error: "private detail" });

    await expect(createProvider(repo).deleteMemory("memory-1")).resolves.toBe(false);

    expect(repo.transitionSourceStatus).toHaveBeenCalledWith(
      "memory-1",
      ["processing", "available", "archived"],
      "archived",
    );
    expect(repo.deleteSource).not.toHaveBeenCalled();
  });

  it("retains an archived source when provider deletion throws", async () => {
    const memory = source({ id: "memory-1", vectorId: "vector-1", target: vectorizeTarget });
    const repo = repository();

    repo.getSource.mockResolvedValue(memory);
    mocks.vectorize.delete.mockRejectedValue(new Error("provider timeout"));

    await expect(createProvider(repo).deleteMemory("memory-1")).resolves.toBe(false);

    expect(repo.transitionSourceStatus).toHaveBeenCalledWith(
      "memory-1",
      ["processing", "available", "archived"],
      "archived",
    );
    expect(repo.deleteSource).not.toHaveBeenCalled();
  });

  it("returns a generic provider error when a stored target cannot create a query", async () => {
    const oldMemory = source({
      id: "old-memory",
      vectorId: "old-vector",
      target: vectorizeTarget,
    });

    mocks.vectorize.getQuery.mockResolvedValue({
      data: [],
      status: { success: false, error: "private upstream detail" },
    });

    await expect(
      createProvider(repository([oldMemory]), "s3vectors").retrieveMemories("remember"),
    ).rejects.toMatchObject({
      message: "Unable to access memory embeddings",
      statusCode: 502,
      type: "PROVIDER_ERROR",
    });
  });

  it("does not return a memory deleted while its provider query is in flight", async () => {
    const memory = source({ id: "memory-1", vectorId: "vector-1", target: vectorizeTarget });
    const repo = repository([memory]);

    repo.getSourceByVectorId.mockResolvedValue(
      source({
        id: "memory-1",
        vectorId: "vector-1",
        status: "archived",
        target: vectorizeTarget,
      }),
    );
    mocks.vectorize.getMatches.mockResolvedValue({
      count: 1,
      matches: [{ id: "vector-1", score: 0.9, metadata: {} }],
    });

    await expect(createProvider(repo).retrieveMemories("remember")).resolves.toEqual([]);
  });

  it("retrieves a stored Vectorize memory when the current S3 target cannot resolve", async () => {
    const memory = source({ id: "memory-1", vectorId: "vector-1", target: vectorizeTarget });

    mocks.resolveEmbeddingProviderTarget.mockRejectedValue(
      new Error("current S3 credentials unavailable"),
    );
    mocks.vectorize.getMatches.mockResolvedValue({
      count: 1,
      matches: [{ id: "vector-1", score: 0.9, metadata: {} }],
    });

    await expect(
      createProvider(repository([memory]), "s3vectors").retrieveMemories("remember"),
    ).resolves.toEqual([
      {
        id: "memory-1",
        text: "memory-1",
        score: 0.9,
        metadata: { authority: "memory-1" },
      },
    ]);
    expect(mocks.resolveEmbeddingProviderTarget).not.toHaveBeenCalled();
  });

  it("bounds concurrent queries across distinct stored targets", async () => {
    let activeQueries = 0;
    let maximumActiveQueries = 0;
    const sources = Array.from({ length: 7 }, (_, index) => {
      const target = {
        ...s3Target,
        target: JSON.stringify({
          bucketName: `memory-bucket-${index}`,
          indexName: `memory-index-${index}`,
          region: "eu-west-1",
        }),
        vectorSpace: `memory-index-${index}`,
      };

      return source({ id: `memory-${index}`, vectorId: `vector-${index}`, target });
    });

    mocks.getEmbeddingProviderForTarget.mockImplementation(() => ({
      ...mocks.s3,
      getQuery: vi.fn(async () => {
        activeQueries += 1;
        maximumActiveQueries = Math.max(maximumActiveQueries, activeQueries);
        await new Promise((resolve) => setTimeout(resolve, 2));
        activeQueries -= 1;

        return { data: [[0.1]], status: { success: true } };
      }),
      getMatches: vi.fn().mockResolvedValue({ count: 0, matches: [] }),
    }));

    await createProvider(repository(sources), "s3vectors").retrieveMemories("remember");

    expect(maximumActiveQueries).toBe(3);
  });
});
