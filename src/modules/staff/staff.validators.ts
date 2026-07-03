import type { StaffRole } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { normalizePhone } from "@/modules/auth/auth.validators";
import type { CreateStaffUserInput, StaffLoginInput } from "./staff.types";

const IRAN_MOBILE_REGEX = /^09\d{9}$/;
const STAFF_ROLES: StaffRole[] = ["admin", "sales_expert"];
const MIN_PASSWORD_LENGTH = 8;

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

function parsePasswordField(
  body: Record<string, unknown>,
  field = "password",
  minLength = MIN_PASSWORD_LENGTH,
): string {
  const value = body[field];
  if (typeof value !== "string" || value.length < minLength) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Password must be at least ${minLength} characters`,
      400,
      { field },
    );
  }

  return value;
}

function parseNameField(body: Record<string, unknown>): string {
  const value = body.name;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError("VALIDATION_ERROR", "Name is required", 400, {
      field: "name",
    });
  }

  return value.trim();
}

function parseStaffRole(body: Record<string, unknown>): StaffRole {
  const value = body.role;
  if (
    typeof value !== "string" ||
    !STAFF_ROLES.includes(value as StaffRole)
  ) {
    throw new AppError("VALIDATION_ERROR", "Invalid staff role", 400, {
      field: "role",
    });
  }

  return value as StaffRole;
}

export function validateStaffLoginRequest(body: unknown): StaffLoginInput {
  if (!body || typeof body !== "object") {
    throw new AppError("VALIDATION_ERROR", "Request body is required", 400);
  }

  const data = body as Record<string, unknown>;
  return {
    phone: parsePhoneField(data),
    password: parsePasswordField(data, "password", 1),
  };
}

export function validateCreateStaffUserRequest(
  body: unknown,
): CreateStaffUserInput {
  if (!body || typeof body !== "object") {
    throw new AppError("VALIDATION_ERROR", "Request body is required", 400);
  }

  const data = body as Record<string, unknown>;
  return {
    name: parseNameField(data),
    phone: parsePhoneField(data),
    password: parsePasswordField(data),
    role: parseStaffRole(data),
  };
}

export function validateResetStaffPasswordRequest(body: unknown): string {
  if (!body || typeof body !== "object") {
    throw new AppError("VALIDATION_ERROR", "Request body is required", 400);
  }

  return parsePasswordField(body as Record<string, unknown>);
}

export function validateSetStaffUserActiveRequest(
  body: unknown,
): { isActive: boolean } {
  if (!body || typeof body !== "object") {
    throw new AppError("VALIDATION_ERROR", "Request body is required", 400);
  }

  const isActive = (body as Record<string, unknown>).isActive;
  if (typeof isActive !== "boolean") {
    throw new AppError("VALIDATION_ERROR", "isActive must be a boolean", 400, {
      field: "isActive",
    });
  }

  return { isActive };
}
