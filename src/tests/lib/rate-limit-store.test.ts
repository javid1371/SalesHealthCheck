import { describe, expect, it, vi } from "vitest";
import { MemoryRateLimitStore } from "@/lib/rate-limit-store";

describe("MemoryRateLimitStore", () => {
  it("allows hits under the limit and blocks after", async () => {
    const store = new MemoryRateLimitStore();

    expect(
      (await store.hit("ns", "user-1", 2, 60_000)).allowed,
    ).toBe(true);
    expect(
      (await store.hit("ns", "user-1", 2, 60_000)).allowed,
    ).toBe(true);

    const blocked = await store.hit("ns", "user-1", 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("isolates namespaces and keys", async () => {
    const store = new MemoryRateLimitStore();

    await store.hit("a", "k", 1, 60_000);
    expect((await store.hit("a", "k", 1, 60_000)).allowed).toBe(false);
    expect((await store.hit("b", "k", 1, 60_000)).allowed).toBe(true);
    expect((await store.hit("a", "other", 1, 60_000)).allowed).toBe(true);
  });

  it("expires hits outside the sliding window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const store = new MemoryRateLimitStore();
    expect((await store.hit("ns", "k", 1, 1_000)).allowed).toBe(true);
    expect((await store.hit("ns", "k", 1, 1_000)).allowed).toBe(false);

    vi.advanceTimersByTime(1_001);
    expect((await store.hit("ns", "k", 1, 1_000)).allowed).toBe(true);

    vi.useRealTimers();
  });

  it("reset clears a namespace or all namespaces", async () => {
    const store = new MemoryRateLimitStore();
    await store.hit("keep", "k", 1, 60_000);
    await store.hit("drop", "k", 1, 60_000);

    await store.reset("drop");
    expect((await store.hit("drop", "k", 1, 60_000)).allowed).toBe(true);
    expect((await store.hit("keep", "k", 1, 60_000)).allowed).toBe(false);

    await store.reset();
    expect((await store.hit("keep", "k", 1, 60_000)).allowed).toBe(true);
  });
});
