import { beforeEach, describe, expect, it, vi } from "vitest";
import { KVCache } from "../cache";

const mockKV = {
	get: vi.fn(),
	put: vi.fn(),
	delete: vi.fn(),
};

describe("KVCache", () => {
	let cache: KVCache;

	beforeEach(() => {
		vi.clearAllMocks();
		cache = new KVCache(mockKV as any, 3600);
	});

	describe("get", () => {
		it("should return parsed JSON value when key exists", async () => {
			const testData = { name: "test", value: 123 };
			mockKV.get.mockResolvedValue(JSON.stringify(testData));

			const result = await cache.get("test-key");

			expect(result).toEqual(testData);
			expect(mockKV.get).toHaveBeenCalledWith("test-key");
		});

		it("should return null when key does not exist", async () => {
			mockKV.get.mockResolvedValue(null);

			const result = await cache.get("nonexistent-key");

			expect(result).toBeNull();
		});

		it("should return null and log error when JSON parsing fails", async () => {
			mockKV.get.mockResolvedValue("invalid-json");

			const result = await cache.get("test-key");

			expect(result).toBeNull();
		});

		it("should return null and log error when KV operation fails", async () => {
			mockKV.get.mockRejectedValue(new Error("KV error"));

			const result = await cache.get("test-key");

			expect(result).toBeNull();
		});
	});

	describe("set", () => {
		it("should store value with default TTL", async () => {
			const testData = { name: "test" };
			mockKV.put.mockResolvedValue(undefined);

			const result = await cache.set("test-key", testData);

			expect(result).toBe(true);
			expect(mockKV.put).toHaveBeenCalledWith(
				"test-key",
				JSON.stringify(testData),
				{ expirationTtl: 3600 },
			);
		});

		it("should store value with custom TTL", async () => {
			const testData = { name: "test" };
			mockKV.put.mockResolvedValue(undefined);

			const result = await cache.set("test-key", testData, { ttl: 1800 });

			expect(result).toBe(true);
			expect(mockKV.put).toHaveBeenCalledWith(
				"test-key",
				JSON.stringify(testData),
				{ expirationTtl: 1800 },
			);
		});

		it("should return false when KV operation fails", async () => {
			mockKV.put.mockRejectedValue(new Error("KV error"));

			const result = await cache.set("test-key", { test: "data" });

			expect(result).toBe(false);
		});
	});

	describe("delete", () => {
		it("should delete key and return true", async () => {
			mockKV.delete.mockResolvedValue(undefined);

			const result = await cache.delete("test-key");

			expect(result).toBe(true);
			expect(mockKV.delete).toHaveBeenCalledWith("test-key");
		});

		it("should return false when deletion fails", async () => {
			mockKV.delete.mockRejectedValue(new Error("KV error"));

			const result = await cache.delete("test-key");

			expect(result).toBe(false);
		});
	});

	describe("has", () => {
		it("should return true when key exists", async () => {
			mockKV.get.mockResolvedValue("some-value");

			const result = await cache.has("test-key");

			expect(result).toBe(true);
		});

		it("should return false when key does not exist", async () => {
			mockKV.get.mockResolvedValue(null);

			const result = await cache.has("test-key");

			expect(result).toBe(false);
		});

		it("should return false when operation fails", async () => {
			mockKV.get.mockRejectedValue(new Error("KV error"));

			const result = await cache.has("test-key");

			expect(result).toBe(false);
		});
	});

	describe("createKey", () => {
		it("should create key with prefix and parts", () => {
			const key = KVCache.createKey("user", "123", "settings");

			expect(key).toBe("user:123:settings");
		});

		it("should handle single part", () => {
			const key = KVCache.createKey("prefix", "single");

			expect(key).toBe("prefix:single");
		});
	});

	describe("cacheQuery", () => {
		it("should return cached value when available", async () => {
			const cachedData = { result: "cached" };
			mockKV.get.mockResolvedValue(JSON.stringify(cachedData));

			const queryFn = vi.fn().mockResolvedValue({ result: "fresh" });
			const result = await cache.cacheQuery("cache-key", queryFn);

			expect(result).toEqual(cachedData);
			expect(queryFn).not.toHaveBeenCalled();
		});

		it("should execute query and cache result when cache miss", async () => {
			const freshData = { result: "fresh" };
			mockKV.get.mockResolvedValue(null);
			mockKV.put.mockResolvedValue(undefined);

			const queryFn = vi.fn().mockResolvedValue(freshData);
			const result = await cache.cacheQuery("cache-key", queryFn);

			expect(result).toEqual(freshData);
			expect(queryFn).toHaveBeenCalled();
			expect(mockKV.put).toHaveBeenCalledWith(
				"cache-key",
				JSON.stringify(freshData),
				{ expirationTtl: 3600 },
			);
		});

		it("should not cache null results when skipIfNull is true", async () => {
			mockKV.get.mockResolvedValue(null);

			const queryFn = vi.fn().mockResolvedValue(null);
			const result = await cache.cacheQuery("cache-key", queryFn, {
				skipIfNull: true,
			});

			expect(result).toBeNull();
			expect(mockKV.put).not.toHaveBeenCalled();
		});

		it("should execute query directly when caching fails", async () => {
			const freshData = { result: "fresh" };
			mockKV.get.mockRejectedValue(new Error("Cache error"));

			const queryFn = vi.fn().mockResolvedValue(freshData);
			const result = await cache.cacheQuery("cache-key", queryFn);

			expect(result).toEqual(freshData);
			expect(queryFn).toHaveBeenCalled();
		});
	});

	describe("clearUserModelCache", () => {
		it("should clear user model cache keys", async () => {
			mockKV.delete.mockResolvedValue(undefined);

			const result = await cache.clearUserModelCache("user-123");

			expect(result).toBe(true);
			expect(mockKV.delete).toHaveBeenCalledWith("user-models:user-123");
			expect(mockKV.delete).toHaveBeenCalledWith(
				"user-provider-settings:user-123",
			);
		});

		it("should return false when deletion fails", async () => {
			mockKV.delete.mockRejectedValue(new Error("Delete error"));

			const result = await cache.clearUserModelCache("user-123");

			expect(result).toBe(false);
		});
	});
});
