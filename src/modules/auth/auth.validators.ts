import { AppError } from "@/lib/errors";
import type { SendOtpInput, VerifyOtpInput } from "./auth.types";

const IRAN_MOBILE_REGEX = /^09\d{9}$/;
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function toAsciiDigits(raw: string): string {
  return raw.replace(/[۰-۹٠-٩]/g, (char) => {
    const persian = PERSIAN_DIGITS.indexOf(char);
    if (persian !== -1) {
      return String(persian);
    }
    const arabic = ARABIC_INDIC_DIGITS.indexOf(char);
    return arabic !== -1 ? String(arabic) : char;
  });
}

/**
 * Normalize Iranian mobile numbers to `09XXXXXXXXX`.
 * Accepts 09..., 9..., +98..., 0098..., Persian/Arabic digits, and strips separators.
 */
export function normalizePhone(raw: string): string | null {
  const digits = toAsciiDigits(raw).replace(/[^\d]/g, "");

  if (digits.length === 11 && digits.startsWith("09")) {
    return digits;
  }

  if (digits.length === 10 && digits.startsWith("9")) {
    return `0${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("989")) {
    return `0${digits.slice(2)}`;
  }

  if (digits.length === 14 && digits.startsWith("00989")) {
    return `0${digits.slice(4)}`;
  }

  return null;
}

function parsePhoneField(
  body: Record<string, unknown>,
  field = "phone",
): string {
  const value = body[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError("VALIDATION_ERROR", "Phone is required", 400, {
      field,
    });
  }

  const normalized = normalizePhone(value.trim());
  if (!normalized || !IRAN_MOBILE_REGEX.test(normalized)) {
    throw new AppError("VALIDATION_ERROR", "Invalid phone format", 400, {
      field,
    });
  }

  return normalized;
}

export function validateSendOtpRequest(body: unknown): SendOtpInput {
  if (!body || typeof body !== "object") {
    throw new AppError("VALIDATION_ERROR", "Request body is required", 400);
  }

  return { phone: parsePhoneField(body as Record<string, unknown>) };
}

export function validateVerifyOtpRequest(body: unknown): VerifyOtpInput {
  if (!body || typeof body !== "object") {
    throw new AppError("VALIDATION_ERROR", "Request body is required", 400);
  }

  const data = body as Record<string, unknown>;
  const phone = parsePhoneField(data);

  const code =
    typeof data.code === "string" ? data.code.trim() : undefined;
  if (!code || !/^\d{6}$/.test(code)) {
    throw new AppError("VALIDATION_ERROR", "Invalid verification code", 400, {
      field: "code",
    });
  }

  return { phone, code };
}
