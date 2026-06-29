import { apiPost, ApiClientError } from "@/lib/api-client";
import type {
  SendOtpResponse,
  VerifyOtpResult,
} from "@/modules/auth/auth.types";

export function formatAuthApiError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.status === 429) {
      const retryAfter =
        typeof err.details === "object" &&
        err.details !== null &&
        "retry_after" in err.details
          ? Number((err.details as { retry_after: number }).retry_after)
          : null;
      if (retryAfter) {
        return `تعداد درخواست‌ها بیش از حد مجاز است. لطفاً ${retryAfter} ثانیه دیگر تلاش کنید.`;
      }
    }
    return err.message;
  }
  return "خطایی رخ داد. لطفاً دوباره تلاش کنید.";
}

export async function sendOtpRequest(phone: string): Promise<SendOtpResponse> {
  return apiPost<SendOtpResponse>("/api/auth/otp/send", { phone });
}

export async function verifyOtpRequest(
  phone: string,
  code: string,
): Promise<VerifyOtpResult> {
  return apiPost<VerifyOtpResult>("/api/auth/otp/verify", { phone, code });
}

export async function logoutRequest(): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>("/api/auth/logout");
}
