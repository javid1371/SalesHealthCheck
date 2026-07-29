import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryCacheStore, setCacheStoreForTests } from "@/lib/cache";
import {
  QUESTION_BANK_CACHE_TTL_SECONDS,
  domainsCacheKey,
  getOrSetCached,
  layersCacheKey,
} from "@/modules/question-bank/question-bank.cache";

const dbMock = vi.hoisted(() => ({
  domain: { findMany: vi.fn() },
  layer: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  loadDomainsWithQuestions,
  loadLayers,
} from "@/modules/question-bank/question-bank.repository";

describe("question-bank cache keys", () => {
  it("builds model-scoped keys", () => {
    expect(domainsCacheKey("mv-1")).toBe("model:mv-1:domains");
    expect(layersCacheKey("mv-1")).toBe("model:mv-1:layers");
  });
});

describe("getOrSetCached", () => {
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore();
    setCacheStoreForTests(store);
  });

  afterEach(() => {
    setCacheStoreForTests(null);
  });

  it("loads on miss and returns cached value on hit", async () => {
    const loader = vi.fn().mockResolvedValue({ n: 1 });

    await expect(getOrSetCached("k", loader)).resolves.toEqual({ n: 1 });
    await expect(getOrSetCached("k", loader)).resolves.toEqual({ n: 1 });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(await store.get("k")).toEqual({ n: 1 });
  });

  it("reloads after ttl expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const loader = vi
      .fn()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");

    await expect(getOrSetCached("ttl", loader, 2)).resolves.toBe("first");
    vi.advanceTimersByTime(2_001);
    await expect(getOrSetCached("ttl", loader, 2)).resolves.toBe("second");

    expect(loader).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe("loadDomainsWithQuestions / loadLayers cache", () => {
  let store: MemoryCacheStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new MemoryCacheStore();
    setCacheStoreForTests(store);
  });

  afterEach(() => {
    setCacheStoreForTests(null);
  });

  it("caches domains for 1h and skips DB on hit", async () => {
    const domains = [{ id: "d1", slug: "lead", questions: [] }];
    dbMock.domain.findMany.mockResolvedValue(domains);

    const first = await loadDomainsWithQuestions("mv-1");
    const second = await loadDomainsWithQuestions("mv-1");

    expect(first).toEqual(domains);
    expect(second).toEqual(domains);
    expect(dbMock.domain.findMany).toHaveBeenCalledTimes(1);
    expect(await store.get(domainsCacheKey("mv-1"))).toEqual(domains);
  });

  it("caches layers separately per model version", async () => {
    const layersA = [{ id: "l1", slug: "a" }];
    const layersB = [{ id: "l2", slug: "b" }];
    dbMock.layer.findMany
      .mockResolvedValueOnce(layersA)
      .mockResolvedValueOnce(layersB);

    await expect(loadLayers("mv-a")).resolves.toEqual(layersA);
    await expect(loadLayers("mv-b")).resolves.toEqual(layersB);
    await expect(loadLayers("mv-a")).resolves.toEqual(layersA);

    expect(dbMock.layer.findMany).toHaveBeenCalledTimes(2);
    expect(await store.get(layersCacheKey("mv-a"))).toEqual(layersA);
    expect(await store.get(layersCacheKey("mv-b"))).toEqual(layersB);
  });

  it("uses a one-hour TTL for question-bank entries", () => {
    expect(QUESTION_BANK_CACHE_TTL_SECONDS).toBe(3600);
  });
});
