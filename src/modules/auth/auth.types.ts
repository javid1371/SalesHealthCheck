export interface SendOtpInput {
  phone: string;
}

export interface SendOtpResponse {
  message: string;
  /** Present in development when SMS is not configured (Kavenegar). */
  devCode?: string;
}

export interface VerifyOtpInput {
  phone: string;
  code: string;
}

export interface VerifyOtpResult {
  userId: string;
}

export const OTP_SEND_SUCCESS_MESSAGE =
  "اگر شماره معتبر باشد، کد تأیید برای شما ارسال می‌شود.";

export const OTP_VERIFY_INVALID_MESSAGE =
  "کد تأیید نامعتبر یا منقضی شده است. لطفاً دوباره تلاش کنید.";
