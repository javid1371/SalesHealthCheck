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

/** 1 OTP send per 60 seconds per normalized phone. */
export const otpSendLimiterByPhone = createRateLimiter({
  limit: 1,
  windowMs: 60 * 1000,
  namespace: "otp-send-phone",
});

/** 20 OTP sends per hour per IP. */
export const otpSendLimiterByIp = createRateLimiter({
  limit: 20,
  windowMs: 60 * 60 * 1000,
  namespace: "otp-send-ip",
});

export interface OtpSendRateLimitResult extends RateLimitResult {}

export function checkOtpSendRateLimit(
  phone: string,
  ip?: string,
): OtpSendRateLimitResult {
  const phoneResult = otpSendLimiterByPhone(phone);
  if (!phoneResult.allowed) {
    return phoneResult;
  }

  if (ip) {
    return otpSendLimiterByIp(ip);
  }

  return { allowed: true };
}

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
