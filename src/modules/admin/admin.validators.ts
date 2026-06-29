import type { AssessmentStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { normalizePhone } from "@/modules/auth/auth.validators";
import type { AdminAssessmentFilter, AdminLoginInput } from "./admin.types";

const ASSESSMENT_STATUSES: AssessmentStatus[] = [
  "started",
  "in_progress",
  "completed",
  "abandoned",
];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parseOptionalDate(value: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError("VALIDATION_ERROR", "Invalid date filter", 400, {
      value,
    });
  }

  return parsed;
}

function parseStatus(value: string | null): AssessmentStatus | undefined {
  if (!value) {
    return undefined;
  }

  if (!ASSESSMENT_STATUSES.includes(value as AssessmentStatus)) {
    throw new AppError("VALIDATION_ERROR", "Invalid status filter", 400, {
      status: value,
    });
  }

  return value as AssessmentStatus;
}

export function validateAdminLoginRequest(body: unknown): AdminLoginInput {
  if (!body || typeof body !== "object") {
    throw new AppError("VALIDATION_ERROR", "Request body is required", 400);
  }

  const data = body as Record<string, unknown>;
  const password =
    typeof data.password === "string" ? data.password : undefined;

  if (!password || password.length === 0) {
    throw new AppError("VALIDATION_ERROR", "Password is required", 400, {
      field: "password",
    });
  }

  return { password };
}

export function validateAdminAssessmentFilter(
  searchParams: URLSearchParams,
): AdminAssessmentFilter {
  const pageRaw = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const pageSizeRaw = Number.parseInt(
    searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE),
    10,
  );

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
      ? Math.min(pageSizeRaw, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  const businessName = searchParams.get("businessName")?.trim() || undefined;

  let phone: string | undefined;
  const phoneRaw = searchParams.get("phone")?.trim();
  if (phoneRaw) {
    phone = normalizePhone(phoneRaw) ?? phoneRaw;
  }

  const startedFrom = parseOptionalDate(searchParams.get("from"));
  let startedTo = parseOptionalDate(searchParams.get("to"));
  if (startedTo) {
    startedTo = new Date(startedTo);
    startedTo.setHours(23, 59, 59, 999);
  }

  return {
    phone,
    businessName,
    status: parseStatus(searchParams.get("status")),
    startedFrom,
    startedTo,
    page,
    pageSize,
  };
}
