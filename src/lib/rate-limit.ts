interface RateLimitResult {
  allowed: boolean;
  retryAfterSec?: number;
}

interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  namespace?: string;
}

type RateLimitStore = Map<string, number[]>;

const stores = new Map<string, RateLimitStore>();

function getStore(namespace: string): RateLimitStore {
  let store = stores.get(namespace);
  if (!store) {
    store = new Map();
    stores.set(namespace, store);
  }
  return store;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const namespace = options.namespace ?? "default";

  return function checkRateLimit(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - options.windowMs;
    const store = getStore(namespace);

    const timestamps = (store.get(key) ?? []).filter((t) => t > windowStart);

    if (timestamps.length >= options.limit) {
      const oldest = timestamps[0]!;
      return {
        allowed: false,
        retryAfterSec: Math.max(
          1,
          Math.ceil((oldest + options.windowMs - now) / 1000),
        ),
      };
    }

    timestamps.push(now);
    store.set(key, timestamps);
    return { allowed: true };
  };
}

/** 3 requests per 15 minutes per IP — access recovery. */
export const recoverAccessLimiter = createRateLimiter({
  limit: 3,
  windowMs: 15 * 60 * 1000,
  namespace: "access-recover",
});

/** 5 requests per hour per IP — consultation lead form. */
export const consultationRequestLimiter = createRateLimiter({
  limit: 5,
  windowMs: 60 * 60 * 1000,
  namespace: "consultation-request",
});

/** 10 requests per hour per IP — start assessment. */
export const startAssessmentLimiter = createRateLimiter({
  limit: 10,
  windowMs: 60 * 60 * 1000,
  namespace: "assessment-start",
});

export function rateLimitResponse(retryAfterSec?: number): Response {
  return Response.json(
    {
      error: {
        code: "rate_limited",
        message:
          "تعداد درخواست‌ها بیش از حد مجاز است. لطفاً بعداً دوباره تلاش کنید.",
        details: { retry_after: retryAfterSec },
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec ?? 60),
      },
    },
  );
}

/** Reset in-memory store (tests only). */
export function resetRateLimitStore(namespace?: string): void {
  if (namespace) {
    stores.delete(namespace);
    return;
  }
  stores.clear();
}
