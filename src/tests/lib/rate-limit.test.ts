import { afterEach, describe, expect, it } from "vitest";
import {
  createRateLimiter,
  pdfDownloadLimiter,
  resetRateLimitStore,
} from "@/lib/rate-limit";
import {
  MemoryRateLimitStore,
  setRateLimitStoreForTests,
} from "@/lib/rate-limit-store";

describe("rate-limit", () => {
  afterEach(async () => {
    await resetRateLimitStore();
    setRateLimitStoreForTests(null);
  });

  it("pdfDownloadLimiter allows 3 per hour then blocks", async () => {
    expect((await pdfDownloadLimiter("pdf-ip")).allowed).toBe(true);
    expect((await pdfDownloadLimiter("pdf-ip")).allowed).toBe(true);
    expect((await pdfDownloadLimiter("pdf-ip")).allowed).toBe(true);
    const blocked = await pdfDownloadLimiter("pdf-ip");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("allows requests under the limit", async () => {
    const limiter = createRateLimiter({
      limit: 3,
      windowMs: 60_000,
      namespace: "test-allow",
    });

    expect((await limiter("ip-1")).allowed).toBe(true);
    expect((await limiter("ip-1")).allowed).toBe(true);
    expect((await limiter("ip-1")).allowed).toBe(true);
  });

  it("blocks requests over the limit within the window", async () => {
    const limiter = createRateLimiter({
      limit: 2,
      windowMs: 60_000,
      namespace: "test-block",
    });

    expect((await limiter("ip-2")).allowed).toBe(true);
    expect((await limiter("ip-2")).allowed).toBe(true);

    const blocked = await limiter("ip-2");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks limits separately per key", async () => {
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 60_000,
      namespace: "test-keys",
    });

    expect((await limiter("ip-a")).allowed).toBe(true);
    expect((await limiter("ip-b")).allowed).toBe(true);
    expect((await limiter("ip-a")).allowed).toBe(false);
  });

  it("uses an injected store", async () => {
    const store = new MemoryRateLimitStore();
    const hitSpy = store.hit.bind(store);
    let hits = 0;
    store.hit = async (...args) => {
      hits += 1;
      return hitSpy(...args);
    };

    const limiter = createRateLimiter({
      limit: 2,
      windowMs: 60_000,
      namespace: "test-inject",
      store,
    });

    expect((await limiter("k")).allowed).toBe(true);
    expect((await limiter("k")).allowed).toBe(true);
    expect((await limiter("k")).allowed).toBe(false);
    expect(hits).toBe(3);
  });
});
