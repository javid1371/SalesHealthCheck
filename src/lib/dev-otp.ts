const DEV_OTP_STORAGE_KEY = "sales-health-check:dev-otp";

interface StoredDevOtp {
  phone: string;
  code: string;
}

export function storeDevOtp(phone: string, code: string): void {
  if (typeof window === "undefined") return;
  const payload: StoredDevOtp = { phone, code };
  sessionStorage.setItem(DEV_OTP_STORAGE_KEY, JSON.stringify(payload));
}

export function readDevOtp(phone: string): string | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(DEV_OTP_STORAGE_KEY);
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as StoredDevOtp;
    return payload.phone === phone ? payload.code : null;
  } catch {
    return null;
  }
}

export function clearDevOtp(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(DEV_OTP_STORAGE_KEY);
}
