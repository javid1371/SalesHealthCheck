import Redis from "ioredis";
import { env } from "@/lib/env";

let redisClient: Redis | null = null;

export function getRedisUrl(): string | undefined {
  return env.redisUrl;
}

/** BullMQ-compatible connection options (avoids duplicate ioredis type trees). */
export function getBullMqConnection(): { url: string } | null {
  const url = getRedisUrl();
  return url ? { url } : null;
}

export function getRedisClient(): Redis | null {
  const url = getRedisUrl();
  if (!url) return null;

  if (!redisClient) {
    redisClient = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }

  return redisClient;
}

export async function pingRedis(): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    if (client.status !== "ready") {
      await client.connect();
    }
    const result = await client.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

export async function closeRedisForTests(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
