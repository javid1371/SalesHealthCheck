import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MemoryCacheStore,
  getCacheStore,
  setCacheStoreForTests,
} from "@/lib/cache";

describe("MemoryCacheStore", () => {
  it("returns null on miss and value on hit", async () => {
    const store = new MemoryCacheStore();
    expect(await store.get("missing")).toBeNull();

    await store.set("greeting", { hello: "world" }, 60);
    expect(await store.get("greeting")).toEqual({ hello: "world" });
  });

  it("expires entries after ttl", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const store = new MemoryCacheStore();
    await store.set("temp", "value", 2);
    expect(await store.get<string>("temp")).toBe("value");

    vi.advanceTimersByTime(2_001);
    expect(await store.get("temp")).toBeNull();

    vi.useRealTimers();
  });

  it("deletes keys", async () => {
    const store = new MemoryCacheStore();
    await store.set("x", 1, 60);
    await store.delete("x");
    expect(await store.get("x")).toBeNull();
  });
});

describe("getCacheStore", () => {
  afterEach(() => {
    setCacheStoreForTests(null);
  });

  it("uses an injected store in tests", async () => {
    const injected = new MemoryCacheStore();
    setCacheStoreForTests(injected);
    await injected.set("k", "v", 60);
    expect(await getCacheStore().get("k")).toBe("v");
  });
});
