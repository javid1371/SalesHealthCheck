import type { LeadStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { healthLevelLabelFa } from "@/lib/health-level";
import { verifyConfiguredPassword } from "@/lib/password-auth";
import type { AdminSession, SalesExpertSession } from "@/lib/session";
import { findAssessmentById, findReportById } from "@/modules/assessment/assessment.repository";
import type {
  CreateConsultationRequestInput,
  CreateConsultationRequestResponse,
} from "@/modules/assessment/assessment.types";
import {
  addConsultationNote,
  countClosedLeadsSince,
  countConsultationRequests,
  countLeadsNeedingFollowUp,
  createConsultationRequest,
  findConsultationNotes,
  findConsultationRequestById,
  findConsultationRequests,
  findLeadsNeedingFollowUp,
  updateConsultationLead,
} from "./consultation.repository";
import type { UpdateConsultationLeadInput } from "./consultation-lead.validators";
import type {
  ConsultationLeadDetail,
  ConsultationListFilter,
  ConsultationListItem,
  ConsultationListResponse,
  ConsultationNoteItem,
  ConsultationsAccessInput,
  ExpertDashboardData,
  ExpertDashboardFollowUpRow,
} from "./consultation.types";
import { validateConsultationRequest } from "./consultation.validators";
import { validateSalesExpertLoginRequest } from "./consultation-list.validators";

const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "جدید",
  contacted: "تماس گرفته‌شده",
  meeting_scheduled: "جلسه تنظیم‌شده",
  closed_won: "بسته — موفق",
  closed_lost: "بسته — ناموفق",
  unreachable: "در دسترس نیست",
};

function verifyResultToken(
  token: string | undefined,
  expected: string,
): void {
  if (!token || token !== expected) {
    throw new AppError(
      "report_access_denied",
      "Invalid or missing access token",
      403,
    );
  }
}

export async function submitConsultationRequest(
  body: unknown,
): Promise<CreateConsultationRequestResponse> {
  const validated = validateConsultationRequest(body);

  if (validated.assessmentSessionId) {
    const assessment = await findAssessmentById(validated.assessmentSessionId);
    if (!assessment) {
      throw new AppError(
        "assessment_not_found",
        "Assessment not found",
        404,
      );
    }
    verifyResultToken(validated.token, assessment.resultToken);
  }

  if (validated.reportId) {
    const report = await findReportById(validated.reportId);
    if (!report) {
      throw new AppError("report_not_found", "Report not found", 404);
    }
    verifyResultToken(validated.token, report.assessmentSession.resultToken);
  }

  const { token: _token, ...input } = validated;

  const record = await createConsultationRequest(
    input satisfies CreateConsultationRequestInput,
  );

  return {
    id: record.id,
    createdAt: record.createdAt.toISOString(),
  };
}

function formatConsultationDate(date: Date): string {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isSalesExpertPasswordValid(password: string): boolean {
  return verifyConfiguredPassword(password, {
    plain: env.salesExpertPassword,
    hash: env.salesExpertPasswordHash,
  });
}

export function hasConsultationsAccess(
  access: ConsultationsAccessInput,
): boolean {
  return Boolean(access.adminSession || access.salesExpertSession);
}

export function requireConsultationsAccess(
  access: ConsultationsAccessInput,
): void {
  if (!hasConsultationsAccess(access)) {
    throw new AppError(
      "UNAUTHORIZED",
      "برای مشاهده درخواست‌های مشاوره ابتدا وارد شوید.",
      401,
    );
  }
}

export function verifySalesExpertPassword(body: unknown): void {
  const { password } = validateSalesExpertLoginRequest(body);

  if (!env.salesExpertPassword && !env.salesExpertPasswordHash) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Sales expert login is not configured",
      500,
    );
  }

  if (!isSalesExpertPasswordValid(password)) {
    throw new AppError("UNAUTHORIZED", "رمز عبور نادرست است.", 401);
  }
}

function isAdminAccess(access: ConsultationsAccessInput): boolean {
  return Boolean(access.adminSession);
}

function resolveListFilter(
  filter: ConsultationListFilter,
  access: ConsultationsAccessInput,
): ConsultationListFilter {
  if (isAdminAccess(access)) {
    return filter;
  }

  const staffUserId = access.salesExpertSession?.staffUserId;
  if (!staffUserId) {
    return { ...filter, assignedToId: "__none__" };
  }

  if (filter.onlyMine || !filter.assignedToId) {
    return { ...filter, assignedToId: staffUserId, onlyUnassigned: false };
  }

  return { ...filter, assignedToId: staffUserId, onlyUnassigned: false };
}

function canAccessLead(
  assignedToId: string | null,
  access: ConsultationsAccessInput,
): boolean {
  if (isAdminAccess(access)) {
    return true;
  }

  const staffUserId = access.salesExpertSession?.staffUserId;
  return Boolean(staffUserId && assignedToId === staffUserId);
}

function assertLeadAccess(
  assignedToId: string | null,
  access: ConsultationsAccessInput,
): void {
  if (!canAccessLead(assignedToId, access)) {
    throw new AppError(
      "FORBIDDEN",
      "دسترسی به این لید مجاز نیست.",
      403,
    );
  }
}

type ConsultationRow = Awaited<
  ReturnType<typeof findConsultationRequests>
>[number];

function toConsultationListItem(row: ConsultationRow): ConsultationListItem {
  const assessmentId = row.assessmentSessionId;
  const reportId = row.reportId;

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    message: row.message,
    status: row.status,
    statusLabel: LEAD_STATUS_LABELS[row.status],
    assignedToId: row.assignedToId,
    assignedToName: row.assignedTo?.name ?? null,
    nextFollowUpAt: row.nextFollowUpAt
      ? formatConsultationDate(row.nextFollowUpAt)
      : null,
    nextFollowUpAtIso: row.nextFollowUpAt
      ? row.nextFollowUpAt.toISOString().slice(0, 10)
      : null,
    createdAt: formatConsultationDate(row.createdAt),
    businessName: row.assessmentSession?.organization.businessName ?? null,
    assessmentUserPhone: row.assessmentSession?.user.phone ?? null,
    overallScorePercentage: row.assessmentSession?.overallScore
      ? Math.round(row.assessmentSession.overallScore.percentage)
      : null,
    assessmentId,
    reportId,
    resultUrl: assessmentId ? `/assessment/${assessmentId}/result` : null,
    reportUrl:
      reportId && assessmentId
        ? `/report/${reportId}?assessmentId=${assessmentId}`
        : null,
    expertViewUrl: assessmentId ? `/expert/${assessmentId}` : null,
    adminAssessmentUrl: assessmentId
      ? `/admin/assessments/${assessmentId}`
      : null,
    detailUrl: `/expert/consultations/${row.id}`,
  };
}

function toConsultationNoteItem(
  note: Awaited<ReturnType<typeof findConsultationNotes>>[number],
): ConsultationNoteItem {
  return {
    id: note.id,
    body: note.body,
    authorName: note.staffUser.name,
    createdAt: formatConsultationDate(note.createdAt),
  };
}

type ConsultationDetailRow = NonNullable<
  Awaited<ReturnType<typeof findConsultationRequestById>>
>;

function toConsultationLeadDetail(row: ConsultationDetailRow): ConsultationLeadDetail {
  const assessmentId = row.assessmentSessionId;
  const reportId = row.reportId;
  const healthLevel = row.assessmentSession?.overallScore?.healthLevel ?? null;

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    message: row.message,
    status: row.status,
    statusLabel: LEAD_STATUS_LABELS[row.status],
    assignedToId: row.assignedToId,
    assignedToName: row.assignedTo?.name ?? null,
    nextFollowUpAt: row.nextFollowUpAt
      ? formatConsultationDate(row.nextFollowUpAt)
      : null,
    nextFollowUpAtIso: row.nextFollowUpAt
      ? row.nextFollowUpAt.toISOString().slice(0, 10)
      : null,
    createdAt: formatConsultationDate(row.createdAt),
    businessName: row.assessmentSession?.organization.businessName ?? null,
    assessmentUserPhone: row.assessmentSession?.user.phone ?? null,
    overallScorePercentage: row.assessmentSession?.overallScore
      ? Math.round(row.assessmentSession.overallScore.percentage)
      : null,
    healthLevel: healthLevel ? healthLevelLabelFa(healthLevel) : null,
    assessmentId,
    reportId,
    resultUrl: assessmentId ? `/assessment/${assessmentId}/result` : null,
    reportUrl:
      reportId && assessmentId
        ? `/report/${reportId}?assessmentId=${assessmentId}`
        : null,
    expertViewUrl: assessmentId ? `/expert/${assessmentId}` : null,
    adminAssessmentUrl: assessmentId
      ? `/admin/assessments/${assessmentId}`
      : null,
    bottlenecks: (row.assessmentSession?.bottlenecks ?? []).map((item) => ({
      title: item.domain.name,
      severity: String(item.rank),
    })),
    diagnoses: (row.assessmentSession?.diagnoses ?? []).map((item) => ({
      title: item.title,
      severity: item.severity,
    })),
    notes: row.consultationNotes.map(toConsultationNoteItem),
  };
}

export async function listConsultationRequests(
  filter: ConsultationListFilter,
  access?: ConsultationsAccessInput,
): Promise<ConsultationListResponse> {
  const effectiveFilter = access
    ? resolveListFilter(filter, access)
    : filter;

  if (effectiveFilter.assignedToId === "__none__") {
    return {
      requests: [],
      pagination: {
        page: filter.page,
        pageSize: filter.pageSize,
        total: 0,
        totalPages: 0,
      },
    };
  }

  const [total, requests] = await Promise.all([
    countConsultationRequests(effectiveFilter),
    findConsultationRequests(effectiveFilter),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / filter.pageSize);

  return {
    requests: requests.map(toConsultationListItem),
    pagination: {
      page: filter.page,
      pageSize: filter.pageSize,
      total,
      totalPages,
    },
  };
}

export async function getConsultationLeadDetail(
  id: string,
  access: ConsultationsAccessInput,
): Promise<ConsultationLeadDetail> {
  requireConsultationsAccess(access);

  const row = await findConsultationRequestById(id);
  if (!row) {
    throw new AppError("NOT_FOUND", "لید یافت نشد.", 404, { id });
  }

  assertLeadAccess(row.assignedToId, access);
  return toConsultationLeadDetail(row);
}

export async function updateConsultationLeadStatus(
  id: string,
  input: UpdateConsultationLeadInput,
  access: ConsultationsAccessInput,
): Promise<ConsultationListItem> {
  requireConsultationsAccess(access);

  const existing = await findConsultationRequestById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", "لید یافت نشد.", 404, { id });
  }

  assertLeadAccess(existing.assignedToId, access);

  if (!isAdminAccess(access) && input.assignedToId !== undefined) {
    throw new AppError(
      "FORBIDDEN",
      "فقط ادمین می‌تواند تخصیص لید را تغییر دهد.",
      403,
    );
  }

  const updated = await updateConsultationLead(id, input);
  return toConsultationListItem(updated);
}

export async function addLeadNote(
  id: string,
  body: string,
  access: ConsultationsAccessInput,
): Promise<ConsultationNoteItem> {
  requireConsultationsAccess(access);

  const staffUserId =
    access.adminSession?.staffUserId ??
    access.salesExpertSession?.staffUserId;

  if (!staffUserId) {
    throw new AppError(
      "FORBIDDEN",
      "برای ثبت یادداشت باید با حساب کاربری داخلی وارد شده باشید.",
      403,
    );
  }

  const existing = await findConsultationRequestById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", "لید یافت نشد.", 404, { id });
  }

  assertLeadAccess(existing.assignedToId, access);

  const note = await addConsultationNote({
    consultationRequestId: id,
    staffUserId,
    body,
  });

  return toConsultationNoteItem(note);
}

export function leadStatusLabel(status: LeadStatus): string {
  return LEAD_STATUS_LABELS[status];
}

function startOfDay(date = new Date()): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date = new Date()): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function startOfMonth(date = new Date()): Date {
  const result = startOfDay(date);
  result.setDate(1);
  return result;
}

function toFollowUpRow(row: ConsultationRow): ExpertDashboardFollowUpRow {
  const item = toConsultationListItem(row);
  return {
    id: item.id,
    name: item.name,
    businessName: item.businessName,
    statusLabel: item.statusLabel,
    nextFollowUpAt: item.nextFollowUpAt,
    detailUrl: item.detailUrl,
  };
}

export async function getExpertDashboard(
  staffUserId: string,
): Promise<ExpertDashboardData> {
  const endOfToday = endOfDay();
  const monthStart = startOfMonth();
  const baseFilter = { assignedToId: staffUserId, page: 1, pageSize: 1 };

  const [
    assignedTotal,
    newLeads,
    followUpDue,
    closedThisMonth,
    todayFollowUps,
  ] = await Promise.all([
    countConsultationRequests(baseFilter),
    countConsultationRequests({ ...baseFilter, status: "new" }),
    countLeadsNeedingFollowUp(staffUserId, endOfToday),
    countClosedLeadsSince(staffUserId, monthStart),
    findLeadsNeedingFollowUp(staffUserId, endOfToday, 10),
  ]);

  return {
    kpis: {
      assignedTotal,
      newLeads,
      followUpDue,
      closedThisMonth,
    },
    todayFollowUps: todayFollowUps.map(toFollowUpRow),
  };
}
