import type Redis from "ioredis";
import { getRedisClient } from "@/lib/redis";

export interface RateLimitHitResult {
  allowed: boolean;
  retryAfterSec?: number;
}

/**
 * Sliding-window counter store.
 * Modules must not talk to Redis directly — use via `createRateLimiter`.
 */
export interface RateLimitStore {
  hit(
    namespace: string,
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitHitResult>;
  reset(namespace?: string): Promise<void>;
}

function redisKey(namespace: string, key: string): string {
  return `rl:${namespace}:${key}`;
}

/** In-memory sliding window for local/dev and tests. */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly namespaces = new Map<string, Map<string, number[]>>();

  private getBucket(namespace: string): Map<string, number[]> {
    let bucket = this.namespaces.get(namespace);
    if (!bucket) {
      bucket = new Map();
      this.namespaces.set(namespace, bucket);
    }
    return bucket;
  }

  async hit(
    namespace: string,
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitHitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const bucket = this.getBucket(namespace);
    const timestamps = (bucket.get(key) ?? []).filter((t) => t > windowStart);

    if (timestamps.length >= limit) {
      const oldest = timestamps[0]!;
      return {
        allowed: false,
        retryAfterSec: Math.max(
          1,
          Math.ceil((oldest + windowMs - now) / 1000),
        ),
      };
    }

    timestamps.push(now);
    bucket.set(key, timestamps);
    return { allowed: true };
  }

  async reset(namespace?: string): Promise<void> {
    if (namespace) {
      this.namespaces.delete(namespace);
      return;
    }
    this.namespaces.clear();
  }
}

const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retryAfter = 1
  if oldest[2] then
    retryAfter = math.ceil((tonumber(oldest[2]) + window - now) / 1000)
    if retryAfter < 1 then retryAfter = 1 end
  end
  return {0, retryAfter}
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return {1, 0}
`;

async function ensureRedisReady(redis: Redis): Promise<void> {
  if (redis.status !== "ready") {
    await redis.connect();
  }
}

/** Redis sorted-set sliding window (multi-instance safe). */
export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly redis: Redis) {}

  async hit(
    namespace: string,
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitHitResult> {
    try {
      await ensureRedisReady(this.redis);
      const now = Date.now();
      const member = `${now}-${Math.random().toString(36).slice(2, 10)}`;
      const result = (await this.redis.eval(
        SLIDING_WINDOW_LUA,
        1,
        redisKey(namespace, key),
        String(now),
        String(windowMs),
        String(limit),
        member,
      )) as [number, number];

      if (result[0] === 1) {
        return { allowed: true };
      }
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Number(result[1]) || 1),
      };
    } catch (err) {
      console.warn("[rate-limit] Redis hit failed — allowing request", err);
      return { allowed: true };
    }
  }

  async reset(namespace?: string): Promise<void> {
    try {
      await ensureRedisReady(this.redis);
      const pattern = namespace ? `rl:${namespace}:*` : "rl:*";
      let cursor = "0";
      do {
        const [next, keys] = await this.redis.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100,
        );
        cursor = next;
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } while (cursor !== "0");
    } catch {
      // ignore — tests typically use MemoryRateLimitStore
    }
  }
}

let defaultStore: RateLimitStore | null = null;

/** Singleton: Redis when available, otherwise memory. */
export function getRateLimitStore(): RateLimitStore {
  if (!defaultStore) {
    const redis = getRedisClient();
    defaultStore = redis
      ? new RedisRateLimitStore(redis)
      : new MemoryRateLimitStore();
  }
  return defaultStore;
}

/** Tests only — reset singleton (pass a store to inject). */
export function setRateLimitStoreForTests(store: RateLimitStore | null): void {
  defaultStore = store;
}
