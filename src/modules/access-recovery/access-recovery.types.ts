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
  "اگر ارزیابی تکمیل‌شده‌ای با این شماره داشته باشید، لینک نتیجه ارسال می‌شود (در صورت ثبت ایمیل، به ایمیل شما).";
