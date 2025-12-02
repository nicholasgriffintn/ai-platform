import type { KVNamespace } from "@cloudflare/workers-types";

import { getLogger } from "~/utils/logger";
import { safeParseJson } from "~/utils/json";

const logger = getLogger({ prefix: "lib/cache" });

export interface CacheOptions {
	ttl?: number;
}

export class KVCache {
	private kv: KVNamespace;
	private defaultTTL = 7200; // 2 hours default
	private static memoryCache = new Map<
		string,
		{ value: unknown; expiresAt: number }
	>();

	constructor(kv: KVNamespace, defaultTTL?: number) {
		this.kv = kv;
		if (defaultTTL) {
			this.defaultTTL = defaultTTL;
		}
	}

	public static clearMemoryCache() {
		KVCache.memoryCache.clear();
	}

	private static getFromMemory<T>(key: string): T | null {
		const entry = KVCache.memoryCache.get(key);
		if (!entry) {
			return null;
		}
		if (entry.expiresAt <= Date.now()) {
			KVCache.memoryCache.delete(key);
			return null;
		}

		logger.debug("Serving cache hit from memory", { key });
		return entry.value as T;
	}

	private static remember<T>(key: string, value: T, ttlSeconds: number) {
		KVCache.memoryCache.set(key, {
			value,
			expiresAt: Date.now() + ttlSeconds * 1000,
		});
	}

	async get<T>(key: string): Promise<T | null> {
		try {
			const inMemoryValue = KVCache.getFromMemory<T>(key);
			if (inMemoryValue !== null) {
				return inMemoryValue;
			}

			logger.debug("Getting value from cache", { key });
			const value = await this.kv.get(key);
			if (value === null) {
				return null;
			}
			const parsed = safeParseJson(value) as T;
			KVCache.remember(key, parsed, this.defaultTTL);
			return parsed;
		} catch (error) {
			logger.error("Failed to get value from cache", { key, error });
			return null;
		}
	}

	async set<T>(
		key: string,
		value: T,
		options?: CacheOptions,
	): Promise<boolean> {
		try {
			logger.debug("Setting value in cache", { key, options });
			const ttl = options?.ttl || this.defaultTTL;
			await this.kv.put(key, JSON.stringify(value), {
				expirationTtl: ttl,
			});
			KVCache.remember(key, value, ttl);
			return true;
		} catch (error) {
			logger.error("Failed to set value in cache", { key, error });
			return false;
		}
	}

	async delete(key: string): Promise<boolean> {
		try {
			logger.debug("Deleting value from cache", { key });
			await this.kv.delete(key);
			KVCache.memoryCache.delete(key);
			return true;
		} catch (error) {
			logger.error("Failed to delete value from cache", { key, error });
			return false;
		}
	}

	async has(key: string): Promise<boolean> {
		try {
			logger.debug("Checking if key exists in cache", { key });
			const inMemoryValue = KVCache.getFromMemory(key);
			if (inMemoryValue !== null) {
				return true;
			}
			const value = await this.kv.get(key);
			return value !== null;
		} catch (error) {
			logger.error("Failed to check if key exists in cache", { key, error });
			return false;
		}
	}

	static createKey(prefix: string, ...parts: string[]): string {
		return `${prefix}:${parts.join(":")}`;
	}

	/**
	 * Cache wrapper for database queries with automatic serialization
	 */
	async cacheQuery<T>(
		cacheKey: string,
		queryFn: () => Promise<T>,
		options?: CacheOptions & { skipIfNull?: boolean },
	): Promise<T> {
		try {
			logger.debug("Attempting to cache DB query", { cacheKey });
			const cached = await this.get<T>(cacheKey);
			if (cached !== null) {
				return cached;
			}

			const result = await queryFn();

			if (result !== null && result !== undefined) {
				await this.set(cacheKey, result, options);
			} else if (!options?.skipIfNull) {
				await this.set(cacheKey, result, {
					ttl: options?.ttl ? Math.min(options.ttl, 300) : 300,
				});
			}

			logger.debug("Cached DB query result", { cacheKey });

			return result;
		} catch (error) {
			logger.error("Failed to cache query", { cacheKey, error });
			return queryFn();
		}
	}

	async clearUserModelCache(userId: string): Promise<boolean> {
		try {
			logger.debug("Clearing user model cache", { userId });
			const userModelKey = KVCache.createKey("user-models", userId);
			const providerSettingsKey = KVCache.createKey(
				"user-provider-settings",
				userId,
			);
			await Promise.all([
				this.kv.delete(userModelKey),
				this.kv.delete(providerSettingsKey),
			]);
			logger.debug("Cleared user model cache", { userId, key: userModelKey });
			return true;
		} catch (error) {
			logger.error("Failed to clear user model cache", { userId, error });
			return false;
		}
	}
}
