import { AppError } from "@/lib/errors";
import { normalizePhone } from "@/modules/auth/auth.validators";
import type {
  CallOutcome,
  LeadStatus,
  LeadSource,
  PurchaseProbability,
} from "@prisma/client";
import type {
  ConsultationListFilter,
  SalesExpertLoginInput,
} from "./consultation.types";
import { CALL_OUTCOMES } from "./lead-activity";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const LEAD_STATUSES: LeadStatus[] = [
  "assessment_in_progress",
  "assessment_incomplete",
  "assessment_completed",
  "new",
  "contacted",
  "meeting_scheduled",
  "closed_won",
  "closed_lost",
  "unreachable",
];

const LEAD_SOURCES: LeadSource[] = ["direct", "system", "messenger"];

const PURCHASE_PROBABILITY_BANDS: PurchaseProbability[] = [
  "low",
  "medium",
  "high",
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

/** Pagination / view chrome — not part of the call-queue identity. */
const QUEUE_EXCLUDED_PARAMS = new Set(["page", "pageSize", "view"]);

/** Queue filter query string for detail ↔ list navigation (no page/view). */
export function consultationQueueQueryString(
  searchParams: URLSearchParams,
): string {
  const next = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    if (QUEUE_EXCLUDED_PARAMS.has(key)) {
      continue;
    }
    if (value !== "") {
      next.set(key, value);
    }
  }
  return next.toString();
}

export function buildConsultationLeadDetailHref(
  leadId: string,
  queueQueryString?: string | null,
): string {
  const base = `/expert/consultations/${leadId}`;
  if (!queueQueryString) {
    return base;
  }
  return `${base}?${queueQueryString}`;
}

export function buildConsultationListHref(
  queueQueryString?: string | null,
): string {
  if (!queueQueryString) {
    return "/expert/consultations";
  }
  return `/expert/consultations?${queueQueryString}`;
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
  const onlyTeamQueueRaw = searchParams.get("onlyTeamQueue");
  const onlyTeamQueue =
    onlyTeamQueueRaw === "true" || onlyTeamQueueRaw === "1";
  const onlyPendingAssignment =
    searchParams.get("onlyPendingAssignment") === "true";
  const onlyOverdueFollowUp =
    searchParams.get("onlyOverdueFollowUp") === "true";
  const onlyFollowUpDueToday =
    searchParams.get("onlyFollowUpDueToday") === "true";
  const excludeAssessmentInProgress =
    searchParams.get("excludeAssessmentInProgress") === "true";
  const onlyStaleNew = searchParams.get("onlyStaleNew") === "true";
  const onlyHot = searchParams.get("onlyHot") === "true";
  const onlyMine = searchParams.get("onlyMine") === "true";

  let source: LeadSource | undefined;
  const sourceRaw = searchParams.get("source")?.trim();
  if (sourceRaw) {
    if (!LEAD_SOURCES.includes(sourceRaw as LeadSource)) {
      throw new AppError("VALIDATION_ERROR", "Invalid source filter", 400);
    }
    source = sourceRaw as LeadSource;
  }

  let purchaseProbabilityBand: PurchaseProbability | undefined;
  const bandRaw = searchParams.get("purchaseProbabilityBand")?.trim();
  if (bandRaw) {
    if (!PURCHASE_PROBABILITY_BANDS.includes(bandRaw as PurchaseProbability)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Invalid probability band filter",
        400,
      );
    }
    purchaseProbabilityBand = bandRaw as PurchaseProbability;
  }

  let lastCallOutcome: CallOutcome | undefined;
  const callOutcomeRaw = searchParams.get("lastCallOutcome")?.trim();
  if (callOutcomeRaw) {
    if (!CALL_OUTCOMES.includes(callOutcomeRaw as CallOutcome)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Invalid lastCallOutcome filter",
        400,
      );
    }
    lastCallOutcome = callOutcomeRaw as CallOutcome;
  }
  const onlyNeverCalled = searchParams.get("onlyNeverCalled") === "true";

  return {
    phone,
    businessName,
    createdFrom,
    createdTo,
    status,
    source,
    purchaseProbabilityBand,
    lastCallOutcome,
    onlyNeverCalled,
    assignedToId,
    onlyUnassigned,
    onlyTeamQueue,
    onlyPendingAssignment,
    onlyOverdueFollowUp,
    onlyFollowUpDueToday,
    excludeAssessmentInProgress,
    onlyStaleNew,
    onlyHot,
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
