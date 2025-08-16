import type { KVNamespace } from "@cloudflare/workers-types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "CACHE" });

export interface CacheOptions {
  ttl?: number;
}

export class KVCache {
  private kv: KVNamespace;
  private defaultTTL = 7200; // 2 hours default

  constructor(kv: KVNamespace, defaultTTL?: number) {
    this.kv = kv;
    if (defaultTTL) {
      this.defaultTTL = defaultTTL;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.kv.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
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
      const ttl = options?.ttl || this.defaultTTL;
      await this.kv.put(key, JSON.stringify(value), {
        expirationTtl: ttl,
      });
      return true;
    } catch (error) {
      logger.error("Failed to set value in cache", { key, error });
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.kv.delete(key);
      return true;
    } catch (error) {
      logger.error("Failed to delete value from cache", { key, error });
      return false;
    }
  }

  async has(key: string): Promise<boolean> {
    try {
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

      return result;
    } catch (error) {
      logger.error("Failed to cache query", { cacheKey, error });
      return queryFn();
    }
  }

  /**
   * Batch cache operations for better performance
   */
  async batchGet<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    
    try {
      // D1 doesn't support batch operations, so we'll use Promise.all for parallel requests
      const promises = keys.map(async (key) => {
        const value = await this.get<T>(key);
        return { key, value };
      });
      
      const resolved = await Promise.all(promises);
      resolved.forEach(({ key, value }) => {
        results.set(key, value);
      });
    } catch (error) {
      logger.error("Failed to batch get cache keys", { keys, error });
    }
    
    return results;
  }

  /**
   * Invalidate cache keys by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // For KV, we need to maintain a list of keys to support pattern invalidation
      const listKey = `_cache_keys:${pattern.replace('*', '')}`;
      const keyList = await this.get<string[]>(listKey) || [];
      
      const deletePromises = keyList
        .filter(key => this.matchesPattern(key, pattern))
        .map(key => this.delete(key));
        
      await Promise.all(deletePromises);
      
      // Update the key list
      const remainingKeys = keyList.filter(key => !this.matchesPattern(key, pattern));
      await this.set(listKey, remainingKeys, { ttl: 86400 });
      
    } catch (error) {
      logger.error("Failed to invalidate cache pattern", { pattern, error });
    }
  }

  private matchesPattern(key: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return regex.test(key);
  }

  async clearUserModelCache(userId: string): Promise<boolean> {
    try {
      const userCachePattern = `user-models:${userId}*`;
      await this.invalidatePattern(userCachePattern);
      return true;
    } catch (error) {
      logger.error("Failed to clear user model cache", { userId, error });
      return false;
    }
  }
}
