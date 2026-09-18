import { describe, expect, it, vi } from "vitest";

import type { EmbeddingProvider, IEnv, IUser, IUserSettings } from "~/types";

import { WORKERS_EMBEDDING_MODEL } from "../../constants";
import { getEmbeddingRuntimeForTarget } from "../../provider";
import { adaptVectorEmbeddingProvider } from "../../runtime";
import {
  decodeEmbeddingRuntimeTarget,
  embeddingRuntimeTargetsEqual,
  encodeEmbeddingRuntimeTarget,
  getEmbeddingRuntimeTargetKey,
  toEmbeddingProviderTarget,
  toEmbeddingRuntimeTarget,
  type EmbeddingRuntimeTarget,
} from "../../target";

const runtimeTarget = (): EmbeddingRuntimeTarget => ({
  embeddingProvider: "vectorize",
  providerTarget: "vectorize-binding",
  model: WORKERS_EMBEDDING_MODEL,
  dimensions: 1024,
  distanceMetric: "provider-configured",
  taskMode: "symmetric",
  vectorSpace: "default",
  vectorSpaceVersion: "v1",
});

const combinedProvider = (overrides: Partial<EmbeddingProvider> = {}): EmbeddingProvider => ({
  generate: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockResolvedValue({ status: "success", error: null }),
  delete: vi.fn().mockResolvedValue({ status: "success", error: null }),
  getQuery: vi.fn().mockResolvedValue({ data: [[0.1, 0.2]], status: { success: true } }),
  getMatches: vi.fn().mockResolvedValue({ matches: [], count: 0 }),
  ...overrides,
});

describe("embedding runtime contracts", () => {
  it("exposes the combined provider through separate embedder and vector-store capabilities", async () => {
    const provider = combinedProvider();
    const runtime = adaptVectorEmbeddingProvider(provider);

    await runtime.embedder.generate("note", "content", "vector-1", { documentId: "doc-1" });
    await runtime.vectorStore.insert([], { scopeTag: `scope_v1_${"a".repeat(32)}` });
    await runtime.vectorStore.getMatches(new Float64Array([0.1, 0.2]), {
      scopeTag: `scope_v1_${"a".repeat(32)}`,
      topK: 5,
    });

    expect(runtime.kind).toBe("vector");
    expect(provider.generate).toHaveBeenCalledWith("note", "content", "vector-1", {
      documentId: "doc-1",
    });
    expect(provider.insert).toHaveBeenCalledWith([], {
      scopeTag: `scope_v1_${"a".repeat(32)}`,
    });
    expect(provider.getMatches).toHaveBeenCalledWith(expect.any(Float64Array), {
      scopeTag: `scope_v1_${"a".repeat(32)}`,
      topK: 5,
    });
  });

  it.each([
    { data: undefined },
    { data: null },
    { data: [] },
    { data: [[Number.NaN]] },
    { data: ["not-a-vector"] },
  ])("rejects malformed combined-provider query output %#", async ({ data }) => {
    const runtime = adaptVectorEmbeddingProvider(
      combinedProvider({
        getQuery: vi.fn().mockResolvedValue({ data, status: { success: true } }),
      }),
    );

    await expect(runtime.embedder.getQuery("query")).rejects.toMatchObject({
      type: "PROVIDER_ERROR",
      statusCode: 502,
    });
  });

  it("round-trips a strict, stable runtime target", () => {
    const target = runtimeTarget();
    const encoded = encodeEmbeddingRuntimeTarget(target);

    expect(decodeEmbeddingRuntimeTarget(encoded)).toEqual(target);
    expect(getEmbeddingRuntimeTargetKey(target)).toBe(encoded);
    expect(toEmbeddingProviderTarget(target)).toEqual({
      provider: "vectorize",
      target: "vectorize-binding",
      model: WORKERS_EMBEDDING_MODEL,
      vectorSpace: "default",
      vectorSpaceVersion: "v1",
    });
    expect(
      toEmbeddingRuntimeTarget({
        provider: "vectorize",
        target: "vectorize-binding",
        model: WORKERS_EMBEDDING_MODEL,
        vectorSpace: "default",
        vectorSpaceVersion: "v1",
      }),
    ).toEqual(target);
  });

  it.each([
    ["embeddingProvider", "s3vectors"],
    ["providerTarget", "another-target"],
    ["model", "another-model"],
    ["dimensions", 768],
    ["distanceMetric", "cosine"],
    ["taskMode", "asymmetric"],
    ["vectorSpace", "another-space"],
    ["vectorSpaceVersion", "v2"],
  ] as const)("includes %s in target equality", (field, value) => {
    const target = runtimeTarget();
    const changed: EmbeddingRuntimeTarget = { ...target, [field]: value };

    expect(embeddingRuntimeTargetsEqual(target, changed)).toBe(false);
  });

  it.each([
    {},
    { ...runtimeTarget(), dimensions: 0 },
    { ...runtimeTarget(), distanceMetric: "inner-product" },
    { ...runtimeTarget(), taskMode: "document" },
    { ...runtimeTarget(), unexpected: true },
  ])("rejects a malformed runtime target %#", (target) => {
    expect(() => decodeEmbeddingRuntimeTarget(target)).toThrow(
      "Embedding runtime target is invalid",
    );
  });

  it("rejects a runtime target with unsupported vector compatibility", () => {
    const env: IEnv = Object.create(null);
    const user: IUser = Object.assign(Object.create(null), { id: 42 });
    const userSettings: IUserSettings = Object.create(null);

    expect(() =>
      getEmbeddingRuntimeForTarget(env, user, userSettings, {
        ...runtimeTarget(),
        dimensions: 768,
      }),
    ).toThrow(expect.objectContaining({ type: "CONFIGURATION_ERROR", statusCode: 503 }));
  });
});
