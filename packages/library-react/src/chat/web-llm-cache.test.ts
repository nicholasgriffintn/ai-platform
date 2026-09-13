import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  cached: new Set<string>(),
  hasModelInCache: vi.fn(),
  deleteModelAllInfoInCache: vi.fn(),
}));

vi.mock("@mlc-ai/web-llm", () => ({
  CreateMLCEngine: vi.fn(),
  hasModelInCache: sdk.hasModelInCache,
  deleteModelAllInfoInCache: sdk.deleteModelAllInfoInCache,
}));

import { isWebLLMModelCached, pruneStaleWebLLMModels } from "./web-llm.js";

beforeEach(() => {
  sdk.cached.clear();
  vi.resetAllMocks();
  sdk.hasModelInCache.mockImplementation(async (modelId: string) => sdk.cached.has(modelId));
  sdk.deleteModelAllInfoInCache.mockImplementation(async (modelId: string) => {
    sdk.cached.delete(modelId);
  });
});

describe("browser model cache cleanup", () => {
  it("reports whether a model is cached", async () => {
    sdk.cached.add("current");

    await expect(isWebLLMModelCached("current")).resolves.toBe(true);
    await expect(isWebLLMModelCached("missing")).resolves.toBe(false);
  });

  it("removes every cached model except the one being kept", async () => {
    sdk.cached.add("current");
    sdk.cached.add("stale-a");
    sdk.cached.add("stale-b");

    const removed = await pruneStaleWebLLMModels("current", ["current", "stale-a", "stale-b"]);

    expect(removed).toEqual(["stale-a", "stale-b"]);
    expect(sdk.deleteModelAllInfoInCache).toHaveBeenCalledTimes(2);
    expect(sdk.cached.has("current")).toBe(true);
  });

  it("skips models that were never downloaded", async () => {
    sdk.cached.add("stale-a");

    const removed = await pruneStaleWebLLMModels("current", ["current", "stale-a", "never"]);

    expect(removed).toEqual(["stale-a"]);
    expect(sdk.deleteModelAllInfoInCache).toHaveBeenCalledTimes(1);
  });

  it("tolerates individual cache failures and keeps pruning", async () => {
    sdk.cached.add("stale-a");
    sdk.cached.add("stale-b");
    sdk.deleteModelAllInfoInCache.mockRejectedValueOnce(new Error("locked"));

    const removed = await pruneStaleWebLLMModels("current", ["stale-a", "stale-b"]);

    expect(removed).toEqual(["stale-b"]);
  });

  it("removes everything when no model is kept", async () => {
    sdk.cached.add("stale-a");

    const removed = await pruneStaleWebLLMModels(null, ["stale-a"]);

    expect(removed).toEqual(["stale-a"]);
  });
});
