import { beforeEach, describe, expect, it, vi } from "vitest";

const getProviderApiKey = vi.hoisted(() => vi.fn());

vi.mock("~/modules/user/infrastructure/UserSettingsRepository", () => ({
  UserSettingsRepository: class {
    getProviderApiKey = getProviderApiKey;
  },
}));

import { S3VectorsEmbeddingProvider } from "../S3VectorsEmbeddingProvider";
import { VectorizeEmbeddingProvider } from "../VectorizeEmbeddingProvider";

describe("embedding provider security boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fall back to platform S3 credentials when user credentials are missing", async () => {
    getProviderApiKey.mockResolvedValue(null);

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
  });

  it("rejects an unscoped write before provider mutation", async () => {
    const vector_db = { upsert: vi.fn() };
    const provider = new VectorizeEmbeddingProvider({ ai: {}, vector_db, repositories: {} } as any);

    await expect(
      provider.insert([{ id: "vector-1", values: [0.1], metadata: {} }], {}),
    ).rejects.toMatchObject({ type: "PARAMS_ERROR", statusCode: 400 });
    expect(vector_db.upsert).not.toHaveBeenCalled();
  });

  it("rejects missing and non-opaque read scopes before provider access", async () => {
    const query = vi.fn();
    const provider = new VectorizeEmbeddingProvider({
      ai: {},
      vector_db: { query },
      repositories: {},
    } as any);

    for (const options of [{}, { scopeTag: "user_kb_42" }]) {
      await expect(provider.getMatches([0.1] as any, options)).rejects.toMatchObject({
        type: "PARAMS_ERROR",
        statusCode: 400,
      });
    }

    expect(query).not.toHaveBeenCalled();
  });
});
