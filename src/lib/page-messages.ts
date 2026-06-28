import { ApiClientError } from "@/lib/api-client";

export const PAGE_MESSAGES = {
  loading: {
    default: "در حال بارگذاری...",
    questions: "در حال بارگذاری سوالات...",
    result: "در حال بارگذاری نتیجه...",
    report: "در حال بارگذاری گزارش...",
    retry: "در حال تلاش مجدد...",
  },
  notFound: {
    questions: "سوالات یافت نشد.",
    result: "نتیجه یافت نشد.",
    report: "گزارش یافت نشد.",
    generic: "اطلاعات یافت نشد.",
  },
  network:
    "خطا در ارتباط با سرور. لطفاً اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.",
  tokenMissing:
    "توکن دسترسی یافت نشد. لطفاً از لینک اصلی استفاده کنید.",
  tokenForbidden:
    "دسترسی مجاز نیست. لطفاً از لینک معتبر ارزیابی خود استفاده کنید.",
  saveFailed: "پاسخ‌ها ذخیره نشدند. لطفاً دوباره تلاش کنید.",
  loadFailed: "بارگذاری اطلاعات با خطا مواجه شد.",
  finishFailed: "تولید گزارش با خطا مواجه شد.",
} as const;

const ACCESS_DENIED_CODES = new Set([
  "assessment_access_denied",
  "report_access_denied",
  "UNAUTHORIZED",
]);

const NOT_FOUND_CODES = new Set([
  "NOT_FOUND",
  "assessment_not_found",
  "questions_not_found",
  "question_not_found",
  "report_not_found",
]);

function isNotFoundCode(code: string): boolean {
  return NOT_FOUND_CODES.has(code) || code.endsWith("_not_found");
}

export function resolveApiError(
  err: unknown,
  fallback: string = PAGE_MESSAGES.loadFailed,
): string {
  if (err instanceof ApiClientError) {
    if (
      err.status === 403 ||
      err.status === 401 ||
      ACCESS_DENIED_CODES.has(err.code)
    ) {
      return PAGE_MESSAGES.tokenForbidden;
    }

    if (err.status === 404 || isNotFoundCode(err.code)) {
      return fallback;
    }

    return err.message || fallback;
  }

  if (err instanceof TypeError) {
    return PAGE_MESSAGES.network;
  }

  return fallback;
}

export function isTokenAccessError(message: string): boolean {
  return (
    message === PAGE_MESSAGES.tokenMissing ||
    message === PAGE_MESSAGES.tokenForbidden ||
    message.includes("توکن") ||
    message.includes("دسترسی")
  );
}
