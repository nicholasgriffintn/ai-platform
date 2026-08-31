import type { KVNamespace } from "@cloudflare/workers-types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { KVCache } from "./cache";

describe("KVCache user model invalidation", () => {
  beforeEach(() => {
    KVCache.clearMemoryCache();
  });

  it("invalidates in-memory provider settings when KV deletion fails", async () => {
    const get = vi.fn().mockResolvedValue(null);
    const kv = {
      delete: vi.fn().mockRejectedValue(new Error("KV unavailable")),
      get,
      put: vi.fn().mockResolvedValue(undefined),
    } as unknown as KVNamespace;
    const cache = new KVCache(kv);
    const providerSettingsKey = KVCache.createKey("user-provider-settings", "42");

    await cache.set(providerSettingsKey, [{ provider_id: "openai", hasApiKey: true }]);

    await expect(cache.clearUserModelCache("42")).resolves.toBe(false);
    await expect(cache.get(providerSettingsKey)).resolves.toBeNull();
    expect(get).toHaveBeenCalledWith(providerSettingsKey);
  });
});
