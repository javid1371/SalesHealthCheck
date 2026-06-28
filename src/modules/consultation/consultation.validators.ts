import { AppError } from "@/lib/errors";
import type { CreateConsultationRequestInput } from "@/modules/assessment/assessment.types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d+\-\s()]{8,20}$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateConsultationRequest(
  body: unknown,
): CreateConsultationRequestInput & { token?: string } {
  if (!body || typeof body !== "object") {
    throw new AppError("VALIDATION_ERROR", "Request body is required", 400);
  }

  const data = body as Record<string, unknown>;

  if (!isNonEmptyString(data.name)) {
    throw new AppError("VALIDATION_ERROR", "Name is required", 400, {
      field: "name",
    });
  }

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

  const message =
    typeof data.message === "string" ? data.message.trim() : undefined;
  const assessmentSessionId =
    typeof data.assessmentSessionId === "string"
      ? data.assessmentSessionId.trim()
      : undefined;
  const reportId =
    typeof data.reportId === "string" ? data.reportId.trim() : undefined;
  const token =
    typeof data.token === "string" ? data.token.trim() : undefined;

  return {
    name: data.name.trim(),
    email: email || undefined,
    phone: phone || undefined,
    message: message || undefined,
    assessmentSessionId: assessmentSessionId || undefined,
    reportId: reportId || undefined,
    token,
  };
}
