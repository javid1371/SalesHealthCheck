import type { LeadStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";

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
};

export function validateUpdateConsultationLeadRequest(
  body: unknown,
): UpdateConsultationLeadInput {
  if (!body || typeof body !== "object") {
    throw new AppError("VALIDATION_ERROR", "Request body is required", 400);
  }

  const data = body as Record<string, unknown>;
  const status = parseOptionalLeadStatus(data.status);
  const assignedToId = parseOptionalStringId(data.assignedToId, "assignedToId");
  let nextFollowUpAt: Date | null | undefined;

  if (data.nextFollowUpAt === null) {
    nextFollowUpAt = null;
  } else if (data.nextFollowUpAt !== undefined) {
    nextFollowUpAt = parseOptionalDate(data.nextFollowUpAt, "nextFollowUpAt");
  }

  if (
    status === undefined &&
    assignedToId === undefined &&
    nextFollowUpAt === undefined
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
