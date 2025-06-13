import type { KVNamespace } from "@cloudflare/workers-types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "CACHE" });

export interface CacheOptions {
  ttl?: number; // TTL in seconds
  expirationTtl?: number; // Alternative TTL name for clarity
}

export class KVCache {
  private kv: KVNamespace;
  private defaultTTL = 300; // 5 minutes default

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

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    try {
      const ttl = options?.ttl || options?.expirationTtl || this.defaultTTL;
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

  // Utility method to create a cache key with prefix
  static createKey(prefix: string, ...parts: string[]): string {
    return `${prefix}:${parts.join(":")}`;
  }

  // Clear user-specific model cache when settings change
  async clearUserModelCache(userId: string): Promise<boolean> {
    try {
      const userModelKey = KVCache.createKey("user-models", userId);
      await this.kv.delete(userModelKey);
      logger.info("Cleared user model cache", { userId, key: userModelKey });
      return true;
    } catch (error) {
      logger.error("Failed to clear user model cache", { userId, error });
      return false;
    }
  }
}