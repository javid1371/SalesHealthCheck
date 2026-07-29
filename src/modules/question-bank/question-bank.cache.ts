import { getCacheStore } from "@/lib/cache";

/** Model version question bank rarely changes; TTL-only invalidation. */
export const QUESTION_BANK_CACHE_TTL_SECONDS = 60 * 60;

export function domainsCacheKey(modelVersionId: string): string {
  return `model:${modelVersionId}:domains`;
}

export function layersCacheKey(modelVersionId: string): string {
  return `model:${modelVersionId}:layers`;
}

/** Read-through cache: miss → loader → set with TTL. */
export async function getOrSetCached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSeconds: number = QUESTION_BANK_CACHE_TTL_SECONDS,
): Promise<T> {
  const store = getCacheStore();
  const hit = await store.get<T>(key);
  if (hit !== null) {
    return hit;
  }

  const value = await loader();
  await store.set(key, value, ttlSeconds);
  return value;
}
