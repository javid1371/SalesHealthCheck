export interface RecoverAccessInput {
  email?: string;
  phone?: string;
}

export interface RecoverAccessResponse {
  message: string;
}

export interface RecoveryEmailPayload {
  to: string;
  resultUrl: string;
}

export const RECOVER_ACCESS_SUCCESS_MESSAGE =
  "اگر ارزیابی تکمیل‌شده‌ای با این مشخصات داشته باشید، لینک نتیجه به ایمیل شما ارسال می‌شود.";
