import { AppError } from "@/lib/errors";
import type { RecoverAccessInput } from "./access-recovery.types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d+\-\s()]{8,20}$/;

export function validateRecoverAccessRequest(body: unknown): RecoverAccessInput {
  if (!body || typeof body !== "object") {
    throw new AppError("VALIDATION_ERROR", "Request body is required", 400);
  }

  const data = body as Record<string, unknown>;

  const email =
    typeof data.email === "string" ? data.email.trim() : undefined;
  const phone =
    typeof data.phone === "string" ? data.phone.trim() : undefined;

  if (!email && !phone) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Email or phone is required",
      400,
    );
  }

  if (email && !EMAIL_REGEX.test(email)) {
    throw new AppError("VALIDATION_ERROR", "Invalid email format", 400, {
      field: "email",
    });
  }

  if (phone && !PHONE_REGEX.test(phone)) {
    throw new AppError("VALIDATION_ERROR", "Invalid phone format", 400, {
      field: "phone",
    });
  }

  return {
    email: email || undefined,
    phone: phone || undefined,
  };
}
