import {
  getRateLimitStore,
  type RateLimitStore,
} from "@/lib/rate-limit-store";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec?: number;
}

interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  namespace?: string;
  /** Inject for tests; defaults to Redis/memory singleton. */
  store?: RateLimitStore;
}

export type RateLimitChecker = (key: string) => Promise<RateLimitResult>;

export function createRateLimiter(options: RateLimiterOptions): RateLimitChecker {
  const namespace = options.namespace ?? "default";

  return async function checkRateLimit(key: string): Promise<RateLimitResult> {
    const store = options.store ?? getRateLimitStore();
    return store.hit(namespace, key, options.limit, options.windowMs);
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

/** 5 requests per 10 minutes per IP — start assessment (campaign). */
export const startAssessmentLimiter = createRateLimiter({
  limit: 5,
  windowMs: 10 * 60 * 1000,
  namespace: "assessment-start",
});

/** 3 finish enqueues per 10 minutes per assessmentId. */
export const finishEnqueueLimiter = createRateLimiter({
  limit: 3,
  windowMs: 10 * 60 * 1000,
  namespace: "assessment-finish-enqueue",
});

/** 3 PDF downloads per hour per IP. */
export const pdfDownloadLimiter = createRateLimiter({
  limit: 3,
  windowMs: 60 * 60 * 1000,
  namespace: "report-pdf",
});

/** 120 requests per hour per IP — anonymous funnel track events. */
export const funnelTrackLimiter = createRateLimiter({
  limit: 120,
  windowMs: 60 * 60 * 1000,
  namespace: "funnel-track",
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

export async function checkOtpSendRateLimit(
  phone: string,
  ip?: string,
): Promise<OtpSendRateLimitResult> {
  const phoneResult = await otpSendLimiterByPhone(phone);
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

/** Reset rate-limit store (tests only). */
export async function resetRateLimitStore(namespace?: string): Promise<void> {
  await getRateLimitStore().reset(namespace);
}
