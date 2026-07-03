import { AppError } from "@/lib/errors";
import { normalizePhone } from "@/modules/auth/auth.validators";
import type { LeadStatus } from "@prisma/client";
import type {
  ConsultationListFilter,
  SalesExpertLoginInput,
} from "./consultation.types";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "meeting_scheduled",
  "closed_won",
  "closed_lost",
  "unreachable",
];

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

export function validateConsultationListFilter(
  searchParams: URLSearchParams,
): ConsultationListFilter {
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

  const createdFrom = parseOptionalDate(searchParams.get("from"));
  let createdTo = parseOptionalDate(searchParams.get("to"));
  if (createdTo) {
    createdTo = new Date(createdTo);
    createdTo.setHours(23, 59, 59, 999);
  }

  let status: LeadStatus | undefined;
  const statusRaw = searchParams.get("status")?.trim();
  if (statusRaw) {
    if (!LEAD_STATUSES.includes(statusRaw as LeadStatus)) {
      throw new AppError("VALIDATION_ERROR", "Invalid status filter", 400);
    }
    status = statusRaw as LeadStatus;
  }

  const assignedToId = searchParams.get("assignedToId")?.trim() || undefined;
  const onlyUnassigned = searchParams.get("onlyUnassigned") === "true";
  const onlyMine = searchParams.get("onlyMine") === "true";

  return {
    phone,
    businessName,
    createdFrom,
    createdTo,
    status,
    assignedToId,
    onlyUnassigned,
    onlyMine,
    page,
    pageSize,
  };
}

export function validateSalesExpertLoginRequest(
  body: unknown,
): SalesExpertLoginInput {
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
