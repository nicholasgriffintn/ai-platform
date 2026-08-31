import { beforeEach, describe, expect, it, vi } from "vitest";

const logger = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));
const getProviderApiKey = vi.hoisted(() => vi.fn());

vi.mock("~/utils/logger", () => ({ getLogger: vi.fn(() => logger) }));
vi.mock("~/repositories/UserSettingsRepository", () => ({
  UserSettingsRepository: class {
    getProviderApiKey = getProviderApiKey;
  },
}));

import { getEmbeddingProviderForTarget, resolveEmbeddingProviderTarget } from "../../helpers";
import {
  getEmbeddingCredentialFingerprint,
  getPersonalEmbeddingScopeTag,
  getProjectEmbeddingScopeTag,
} from "../../utils/scope";
import { BedrockEmbeddingProvider } from "../BedrockEmbeddingProvider";
import { MarengoEmbeddingProvider } from "../MarengoEmbeddingProvider";
import { MistralEmbeddingProvider } from "../MistralEmbeddingProvider";
import { S3VectorsEmbeddingProvider } from "../S3VectorsEmbeddingProvider";
import { VectorizeEmbeddingProvider } from "../VectorizeEmbeddingProvider";

const VALID_SCOPE_TAG = `scope_v1_${"a".repeat(32)}`;

describe("embedding provider security boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends only opaque scoped metadata and never logs embedding payload sentinels", async () => {
    const contentSentinel = "private-content-sentinel";
    const querySentinel = "private-query-sentinel";
    const resultSentinel = "private-result-sentinel";
    const errorSentinel = "private-error-sentinel";
    const upsert = vi.fn().mockResolvedValue(undefined);
    const query = vi.fn().mockResolvedValue({
      matches: [{ id: "vector-1", score: 0.9, metadata: { leaked: resultSentinel } }],
    });
    const provider = new VectorizeEmbeddingProvider({
      ai: { run: vi.fn().mockResolvedValue({ data: [[0.1, 0.2]] }) },
      vector_db: { upsert, query, deleteByIds: vi.fn() },
      repositories: {},
    } as any);

    await provider.generate("note", contentSentinel, "vector-1", { documentId: "document-1" });
    await provider.insert(
      [
        {
          id: "vector-1",
          values: [0.1, 0.2],
          metadata: {
            documentId: "document-1",
            chunkId: "chunk-1",
            chunkIndex: 0,
            type: "note",
            content: contentSentinel,
            namespace: "user_kb_42",
            userId: "42",
          },
        },
      ],
      { scopeTag: VALID_SCOPE_TAG, namespace: "user_kb_42", userId: 42 },
    );
    await provider.getQuery(querySentinel);
    await provider.getMatches(new Float32Array([987654.321]), { scopeTag: VALID_SCOPE_TAG });
    upsert.mockRejectedValueOnce(new Error(errorSentinel));
    await expect(
      provider.insert([{ id: "vector-2", values: [0.2], metadata: {} }], {
        scopeTag: VALID_SCOPE_TAG,
      }),
    ).rejects.toThrow(errorSentinel);

    const providerPayload = JSON.stringify(upsert.mock.calls[0]);
    const logPayload = JSON.stringify(Object.values(logger).flatMap((mock) => mock.mock.calls));

    expect(providerPayload).toContain(VALID_SCOPE_TAG);
    expect(providerPayload).not.toContain("user_kb_42");
    expect(providerPayload).not.toContain(contentSentinel);
    expect(logPayload).not.toContain(contentSentinel);
    expect(logPayload).not.toContain(querySentinel);
    expect(logPayload).not.toContain(resultSentinel);
    expect(logPayload).not.toContain("987654.321");
    expect(logPayload).not.toContain(errorSentinel);
  });

  it("loads S3 Vectors credentials from the S3 provider key", async () => {
    getProviderApiKey.mockResolvedValue("access::@@::secret");
    const provider = new S3VectorsEmbeddingProvider(
      {
        bucketName: "bucket",
        accessKeyId: "",
        secretAccessKey: "",
        ai: {},
      } as any,
      { DB: {} } as any,
      { id: 42 } as any,
    );

    await provider.getAwsClient();

    expect(getProviderApiKey).toHaveBeenCalledWith(42, "s3vectors");
  });

  it("refuses to redirect a stored S3 target after credential rotation", async () => {
    const scopeSecret = "test-s3-credential-scope-secret-at-least-32-chars";
    const originalCredential = "original-access::@@::original-secret";
    const expectedCredentialFingerprint = await getEmbeddingCredentialFingerprint(
      scopeSecret,
      originalCredential,
    );
    const createProvider = () =>
      new S3VectorsEmbeddingProvider(
        {
          bucketName: "bucket",
          indexName: "index",
          accessKeyId: "",
          secretAccessKey: "",
          expectedCredentialFingerprint,
          ai: {},
        } as any,
        { DB: {}, EMBEDDING_SCOPE_SECRET: scopeSecret } as any,
        { id: 42 } as any,
      );

    getProviderApiKey.mockResolvedValueOnce(originalCredential);
    await expect(createProvider().getAwsClient()).resolves.toBeDefined();

    getProviderApiKey.mockResolvedValueOnce("rotated-access::@@::rotated-secret");
    await expect(createProvider().getAwsClient()).rejects.toMatchObject({
      type: "CONFIGURATION_ERROR",
    });
  });

  it("rejects malformed S3 credentials before recording a provider target", async () => {
    getProviderApiKey.mockResolvedValue("malformed-credential");

    await expect(
      resolveEmbeddingProviderTarget(
        {
          EMBEDDING_SCOPE_SECRET: "test-s3-credential-scope-secret-at-least-32-chars",
        } as any,
        { id: 42 } as any,
        {
          embedding_provider: "s3vectors",
          s3vectors_bucket_name: "bucket",
          s3vectors_index_name: "index",
          s3vectors_region: "us-east-1",
        } as any,
      ),
    ).rejects.toMatchObject({ type: "CONFIGURATION_ERROR" });
  });

  it.each([
    { name: "missing", apiKey: null, error: undefined },
    { name: "malformed", apiKey: "platform-access:platform-secret", error: undefined },
    { name: "empty access key", apiKey: "::@@::secret", error: undefined },
    { name: "empty secret key", apiKey: "access::@@::", error: undefined },
    { name: "unavailable", apiKey: undefined, error: new Error("database unavailable") },
  ])(
    "does not fall back to platform S3 credentials when user credentials are $name",
    async ({ apiKey, error }) => {
      if (error) {
        getProviderApiKey.mockRejectedValue(error);
      } else {
        getProviderApiKey.mockResolvedValue(apiKey);
      }

      const provider = new S3VectorsEmbeddingProvider(
        {
          bucketName: "bucket",
          indexName: "index",
          accessKeyId: "platform-access",
          secretAccessKey: "platform-secret",
          ai: {},
        } as any,
        { DB: {} } as any,
        { id: 42 } as any,
      );

      await expect(provider.getAwsClient()).rejects.toMatchObject({
        type: "CONFIGURATION_ERROR",
      });
    },
  );

  it("requires a credential database for an authenticated S3 user", async () => {
    const provider = new S3VectorsEmbeddingProvider(
      {
        bucketName: "bucket",
        indexName: "index",
        accessKeyId: "platform-access",
        secretAccessKey: "platform-secret",
        ai: {},
      } as any,
      {} as any,
      { id: 42 } as any,
    );

    await expect(provider.getAwsClient()).rejects.toMatchObject({
      type: "CONFIGURATION_ERROR",
    });
    expect(getProviderApiKey).not.toHaveBeenCalled();
  });

  it("splits S3 Vectors deletion at the provider's 500-key boundary", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const provider = new S3VectorsEmbeddingProvider(
      {
        bucketName: "bucket",
        indexName: "index",
        accessKeyId: "access",
        secretAccessKey: "secret",
        ai: {},
      } as any,
      {} as any,
    );

    vi.spyOn(provider, "getAwsClient").mockResolvedValue({ fetch } as any);
    const ids = Array.from({ length: 501 }, (_, index) => `vector-${index}`);

    await expect(provider.delete(ids)).resolves.toEqual({ status: "success", error: null });

    expect(fetch).toHaveBeenCalledTimes(2);
    const requestBodies = fetch.mock.calls.map((call) => JSON.parse(String(call[1]?.body)));

    expect(requestBodies.map(({ keys }) => keys.length)).toEqual([500, 1]);
    expect(requestBodies.flatMap(({ keys }) => keys)).toEqual(ids);
    expect(requestBodies).toEqual([
      expect.objectContaining({ vectorBucketName: "bucket", indexName: "index" }),
      expect.objectContaining({ vectorBucketName: "bucket", indexName: "index" }),
    ]);
  });

  it("serialises typed query vectors as an S3 float32 array", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ vectors: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const provider = new S3VectorsEmbeddingProvider(
      {
        bucketName: "bucket",
        indexName: "index",
        accessKeyId: "access",
        secretAccessKey: "secret",
        ai: {},
      } as any,
      {} as any,
    );

    vi.spyOn(provider, "getAwsClient").mockResolvedValue({ fetch } as any);

    await provider.getMatches(new Float64Array([0.1, 0.2]), { scopeTag: VALID_SCOPE_TAG });

    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toMatchObject({
      queryVector: { float32: [0.1, 0.2] },
    });
  });

  it("derives deterministic opaque tags that separate personal and project scopes", async () => {
    const secret = "test-scope-secret-at-least-32-characters";
    const personal = await getPersonalEmbeddingScopeTag(secret, 42);
    const repeatedPersonal = await getPersonalEmbeddingScopeTag(secret, 42);
    const anotherPersonal = await getPersonalEmbeddingScopeTag(secret, 43);
    const project = await getProjectEmbeddingScopeTag(secret, "42");

    expect(personal).toBe(repeatedPersonal);
    expect(personal).toMatch(/^scope_v1_[a-f0-9]{32}$/);
    expect(personal).not.toContain("42");
    expect(project).not.toContain("42");
    expect(new Set([personal, anotherPersonal, project]).size).toBe(3);
  });

  it.each([
    {
      name: "Vectorize",
      create: (ai: { run: ReturnType<typeof vi.fn> }) =>
        new VectorizeEmbeddingProvider({ ai, vector_db: {}, repositories: {} } as any),
    },
    {
      name: "S3 Vectors",
      create: (ai: { run: ReturnType<typeof vi.fn> }) =>
        new S3VectorsEmbeddingProvider(
          {
            bucketName: "bucket",
            accessKeyId: "access",
            secretAccessKey: "secret",
            ai,
          } as any,
          {} as any,
        ),
    },
  ])("rejects malformed and non-finite $name model output", async ({ create }) => {
    await Promise.all(
      [{}, { data: [] }, { data: [[Number.NaN]] }, { data: [[Infinity]] }].map(async (response) => {
        const ai = { run: vi.fn().mockResolvedValue(response) };
        const provider = create(ai);

        await expect(
          provider.generate("note", "private content", "vector-1", {}),
        ).rejects.toMatchObject({ type: "PROVIDER_ERROR", statusCode: 502 });
      }),
    );
  });

  it("rejects Bedrock as an embedding lifecycle provider", async () => {
    await expect(
      resolveEmbeddingProviderTarget(
        {} as any,
        { id: 42 } as any,
        { embedding_provider: "bedrock" } as any,
      ),
    ).rejects.toMatchObject({ type: "CONFIGURATION_ERROR", statusCode: 503 });
  });

  it("rejects unsupported configured providers and malformed stored S3 targets", async () => {
    await expect(
      resolveEmbeddingProviderTarget(
        {} as any,
        { id: 42 } as any,
        { embedding_provider: "mistral" } as any,
      ),
    ).rejects.toMatchObject({ type: "CONFIGURATION_ERROR", statusCode: 503 });

    expect(() =>
      getEmbeddingProviderForTarget({} as any, { id: 42 } as any, {} as any, {
        provider: "s3vectors",
        target: JSON.stringify({
          bucketName: "INVALID_BUCKET",
          indexName: "index",
          region: "us-east-1",
        }),
        model: "model",
        vectorSpace: "index",
        vectorSpaceVersion: "v1",
      }),
    ).toThrow(expect.objectContaining({ type: "CONFIGURATION_ERROR", statusCode: 500 }));
  });

  it.each([
    {
      name: "Vectorize",
      create: (vector_db: Record<string, ReturnType<typeof vi.fn>>) =>
        new VectorizeEmbeddingProvider({ ai: {}, vector_db, repositories: {} } as any),
    },
    {
      name: "S3 Vectors",
      create: (_vector_db: Record<string, ReturnType<typeof vi.fn>>) =>
        new S3VectorsEmbeddingProvider(
          {
            bucketName: "bucket",
            indexName: "index",
            accessKeyId: "access",
            secretAccessKey: "secret",
            ai: {},
          } as any,
          {} as any,
        ),
    },
    {
      name: "Mistral",
      create: (vector_db: Record<string, ReturnType<typeof vi.fn>>) =>
        new MistralEmbeddingProvider({ vector_db } as any, {} as any),
    },
    {
      name: "Marengo",
      create: (vector_db: Record<string, ReturnType<typeof vi.fn>>) =>
        new MarengoEmbeddingProvider({ vector_db } as any, {} as any),
    },
  ])("rejects an unscoped $name write before provider mutation", async ({ create }) => {
    const vector_db = { upsert: vi.fn() };
    const provider = create(vector_db);

    await expect(
      provider.insert([{ id: "vector-1", values: [0.1], metadata: {} }], {}),
    ).rejects.toMatchObject({ type: "PARAMS_ERROR", statusCode: 400 });
    expect(vector_db.upsert).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "Vectorize",
      create: () => {
        const query = vi.fn();

        return {
          provider: new VectorizeEmbeddingProvider({
            ai: {},
            vector_db: { query },
            repositories: {},
          } as any),
          providerCall: query,
        };
      },
    },
    {
      name: "S3 Vectors",
      create: () => {
        const provider = new S3VectorsEmbeddingProvider(
          {
            bucketName: "bucket",
            indexName: "index",
            accessKeyId: "access",
            secretAccessKey: "secret",
            ai: {},
          } as any,
          {} as any,
        );
        const getAwsClient = vi.spyOn(provider, "getAwsClient");

        return { provider, providerCall: getAwsClient };
      },
    },
    {
      name: "Mistral",
      create: () => {
        const query = vi.fn();

        return {
          provider: new MistralEmbeddingProvider({ vector_db: { query } } as any, {} as any),
          providerCall: query,
        };
      },
    },
    {
      name: "Bedrock",
      create: () => {
        const provider = new BedrockEmbeddingProvider(
          {
            knowledgeBaseId: "knowledge-base",
            knowledgeBaseCustomDataSourceId: "data-source",
            accessKeyId: "access",
            secretAccessKey: "secret",
          },
          {} as any,
        );
        const getAwsClient = vi.spyOn(provider, "getAwsClient");

        return { provider, providerCall: getAwsClient };
      },
    },
  ])(
    "rejects missing and non-opaque $name read scopes before provider access",
    async ({ create }) => {
      await Promise.all(
        [{}, { scopeTag: "user_kb_42" }].map(async (options) => {
          const { provider, providerCall } = create();

          await expect(provider.getMatches([0.1] as any, options)).rejects.toMatchObject({
            type: "PARAMS_ERROR",
            statusCode: 400,
          });
          expect(providerCall).not.toHaveBeenCalled();
        }),
      );
    },
  );

  it.each([
    {
      name: "Vectorize",
      create: (vector_db: { deleteByIds: ReturnType<typeof vi.fn> }) =>
        new VectorizeEmbeddingProvider({ ai: {}, vector_db, repositories: {} } as any),
    },
    {
      name: "Mistral",
      create: (vector_db: { deleteByIds: ReturnType<typeof vi.fn> }) =>
        new MistralEmbeddingProvider({ vector_db } as any, {} as any),
    },
    {
      name: "Marengo",
      create: (vector_db: { deleteByIds: ReturnType<typeof vi.fn> }) =>
        new MarengoEmbeddingProvider({ vector_db } as any, {} as any),
    },
  ])("pages $name deletes at 500 vector IDs", async ({ create }) => {
    const deleteByIds = vi.fn().mockResolvedValue(undefined);
    const provider = create({ deleteByIds });
    const ids = Array.from({ length: 501 }, (_, index) => `vector-${index}`);

    await expect(provider.delete(ids)).resolves.toMatchObject({ status: "success" });
    expect(deleteByIds).toHaveBeenCalledTimes(2);
    expect(deleteByIds.mock.calls.map(([page]) => page.length)).toEqual([500, 1]);
  });
});
