import type Redis from "ioredis";
import { getRedisClient } from "@/lib/redis";

export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}

type MemoryEntry = {
  value: unknown;
  expiresAt: number | null;
};

/** In-memory cache for local/dev and tests (no Redis). */
export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, MemoryEntry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const expiresAt =
      ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.entries.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  /** Test helper — clear all keys. */
  clear(): void {
    this.entries.clear();
  }
}

async function ensureRedisReady(redis: Redis): Promise<void> {
  if (redis.status !== "ready") {
    await redis.connect();
  }
}

/** Redis-backed cache when `REDIS_URL` is set. */
export class RedisCacheStore implements CacheStore {
  constructor(private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      await ensureRedisReady(this.redis);
      const raw = await this.redis.get(key);
      if (raw == null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await ensureRedisReady(this.redis);
      const payload = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await this.redis.set(key, payload, "EX", ttlSeconds);
      } else {
        await this.redis.set(key, payload);
      }
    } catch {
      // Fail open — cache miss path remains correct.
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await ensureRedisReady(this.redis);
      await this.redis.del(key);
    } catch {
      // ignore
    }
  }
}

let defaultStore: CacheStore | null = null;

/** Singleton: Redis when available, otherwise memory. */
export function getCacheStore(): CacheStore {
  if (!defaultStore) {
    const redis = getRedisClient();
    defaultStore = redis
      ? new RedisCacheStore(redis)
      : new MemoryCacheStore();
  }
  return defaultStore;
}

/** Tests only — reset singleton (pass a store to inject). */
export function setCacheStoreForTests(store: CacheStore | null): void {
  defaultStore = store;
}
