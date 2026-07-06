import type { LeadStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import type {
  BulkUpdateLeadsInput,
  CreateManualLeadInput,
} from "./consultation.types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d+\-\s()]{8,20}$/;

const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "meeting_scheduled",
  "closed_won",
  "closed_lost",
  "unreachable",
];

function parseOptionalDate(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError("VALIDATION_ERROR", `Invalid ${field}`, 400, { field });
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError("VALIDATION_ERROR", `Invalid ${field}`, 400, { field });
  }

  return parsed;
}

function parseOptionalLeadStatus(value: unknown): LeadStatus | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    !LEAD_STATUSES.includes(value as LeadStatus)
  ) {
    throw new AppError("VALIDATION_ERROR", "Invalid lead status", 400, {
      field: "status",
    });
  }

  return value as LeadStatus;
}

function parseOptionalStringId(
  value: unknown,
  field: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError("VALIDATION_ERROR", `Invalid ${field}`, 400, { field });
  }

  return value.trim();
}

export type UpdateConsultationLeadInput = {
  status?: LeadStatus;
  assignedToId?: string | null;
  nextFollowUpAt?: Date | null;
  adminProbabilityOverridePercent?: number | null;
};

function parseOptionalProbabilityOverride(
  value: unknown,
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Invalid adminProbabilityOverridePercent",
      400,
      { field: "adminProbabilityOverridePercent" },
    );
  }

  if (value < 0 || value > 100) {
    throw new AppError(
      "VALIDATION_ERROR",
      "adminProbabilityOverridePercent must be between 0 and 100",
      400,
      { field: "adminProbabilityOverridePercent" },
    );
  }

  return value;
}

export function validateUpdateConsultationLeadRequest(
  body: unknown,
): UpdateConsultationLeadInput {
  if (!body || typeof body !== "object") {
    throw new AppError("VALIDATION_ERROR", "Request body is required", 400);
  }

  const data = body as Record<string, unknown>;
  const status = parseOptionalLeadStatus(data.status);
  const assignedToId = parseOptionalStringId(data.assignedToId, "assignedToId");
  const adminProbabilityOverridePercent = parseOptionalProbabilityOverride(
    data.adminProbabilityOverridePercent,
  );
  let nextFollowUpAt: Date | null | undefined;

  if (data.nextFollowUpAt === null) {
    nextFollowUpAt = null;
  } else if (data.nextFollowUpAt !== undefined) {
    nextFollowUpAt = parseOptionalDate(data.nextFollowUpAt, "nextFollowUpAt");
  }

  if (
    status === undefined &&
    assignedToId === undefined &&
    nextFollowUpAt === undefined &&
    adminProbabilityOverridePercent === undefined
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "At least one field must be provided",
      400,
    );
  }

  return {
    ...(status !== undefined ? { status } : {}),
    ...(assignedToId !== undefined ? { assignedToId } : {}),
    ...(nextFollowUpAt !== undefined ? { nextFollowUpAt } : {}),
    ...(adminProbabilityOverridePercent !== undefined
      ? { adminProbabilityOverridePercent }
      : {}),
  };
}

export function validateCreateManualLeadRequest(
  body: unknown,
): CreateManualLeadInput {
  if (!body || typeof body !== "object") {
    throw new AppError("VALIDATION_ERROR", "Request body is required", 400);
  }

  const data = body as Record<string, unknown>;

  if (typeof data.name !== "string" || data.name.trim().length === 0) {
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

  return {
    name: data.name.trim(),
    email: email || undefined,
    phone: phone || undefined,
    message: message || undefined,
  };
}

export function validateBulkUpdateLeadsRequest(
  body: unknown,
): BulkUpdateLeadsInput {
  if (!body || typeof body !== "object") {
    throw new AppError("VALIDATION_ERROR", "Request body is required", 400);
  }

  const data = body as Record<string, unknown>;

  if (!Array.isArray(data.ids) || data.ids.length === 0) {
    throw new AppError("VALIDATION_ERROR", "ids must be a non-empty array", 400, {
      field: "ids",
    });
  }

  const ids = data.ids.map((id, index) => {
    if (typeof id !== "string" || id.trim().length === 0) {
      throw new AppError("VALIDATION_ERROR", "Invalid lead id", 400, {
        field: "ids",
        index,
      });
    }
    return id.trim();
  });

  const status = parseOptionalLeadStatus(data.status);
  const assignedToId = parseOptionalStringId(data.assignedToId, "assignedToId");

  if (status === undefined && assignedToId === undefined) {
    throw new AppError(
      "VALIDATION_ERROR",
      "At least one of status or assignedToId must be provided",
      400,
    );
  }

  return {
    ids,
    ...(status !== undefined ? { status } : {}),
    ...(assignedToId !== undefined ? { assignedToId } : {}),
  };
}

export function validateAddConsultationNoteRequest(body: unknown): string {
  if (!body || typeof body !== "object") {
    throw new AppError("VALIDATION_ERROR", "Request body is required", 400);
  }

  const value = (body as Record<string, unknown>).body;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError("VALIDATION_ERROR", "Note body is required", 400, {
      field: "body",
    });
  }

  return value.trim();
}
