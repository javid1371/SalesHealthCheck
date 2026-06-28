import { afterEach, describe, expect, it } from "vitest";
import {
  createRateLimiter,
  resetRateLimitStore,
} from "@/lib/rate-limit";

describe("rate-limit", () => {
  afterEach(() => {
    resetRateLimitStore();
  });

  it("allows requests under the limit", () => {
    const limiter = createRateLimiter({
      limit: 3,
      windowMs: 60_000,
      namespace: "test-allow",
    });

    expect(limiter("ip-1").allowed).toBe(true);
    expect(limiter("ip-1").allowed).toBe(true);
    expect(limiter("ip-1").allowed).toBe(true);
  });

  it("blocks requests over the limit within the window", () => {
    const limiter = createRateLimiter({
      limit: 2,
      windowMs: 60_000,
      namespace: "test-block",
    });

    expect(limiter("ip-2").allowed).toBe(true);
    expect(limiter("ip-2").allowed).toBe(true);

    const blocked = limiter("ip-2");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks limits separately per key", () => {
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 60_000,
      namespace: "test-keys",
    });

    expect(limiter("ip-a").allowed).toBe(true);
    expect(limiter("ip-b").allowed).toBe(true);
    expect(limiter("ip-a").allowed).toBe(false);
  });
});
