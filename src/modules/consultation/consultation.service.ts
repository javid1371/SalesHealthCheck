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
  ResultAccessInput,
} from "@/modules/assessment/assessment.types";
import {
  addConsultationNote,
  countClosedLeadsSince,
  countConsultationRequests,
  countLeadsNeedingFollowUp,
  createConsultationRequest,
  createLeadActivity,
  createManualConsultationRequest,
  findAllConsultationRequests,
  findConsultationNotes,
  findConsultationRequestByAssessmentSessionId,
  findConsultationRequestById,
  findConsultationRequests,
  findConsultationRequestsByIds,
  findLeadsNeedingFollowUp,
  updateConsultationLead,
} from "./consultation.repository";
import type { UpdateConsultationLeadInput } from "./consultation-lead.validators";
import type {
  BulkUpdateLeadsInput,
  ConsultationLeadDetail,
  ConsultationListFilter,
  ConsultationListItem,
  ConsultationListResponse,
  ConsultationNoteItem,
  ConsultationsAccessInput,
  CreateManualLeadInput,
  ExpertDashboardData,
  ExpertDashboardFollowUpRow,
  LeadTimelineEntry,
} from "./consultation.types";
import { validateConsultationRequest } from "./consultation.validators";
import { validateSalesExpertLoginRequest } from "./consultation-list.validators";
import { hookConsultationSubmitted } from "@/modules/sms-funnel/hooks";
import {
  formatPurchaseProbabilityLabel,
  LEAD_SOURCE_LABELS,
  resolveEffectivePurchaseProbability,
} from "./lead-insights";
import { finalizeNewLead, upgradeExistingLeadToDirect } from "./lead-assignment.service";
import {
  formatActivityDetail,
  LEAD_ACTIVITY_LABELS,
} from "./lead-activity";
import { computeLeadSlaFlags, slaReasonLabel } from "./lead-sla";

const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "جدید",
  contacted: "تماس گرفته‌شده",
  meeting_scheduled: "جلسه تنظیم‌شده",
  closed_won: "بسته — موفق",
  closed_lost: "بسته — ناموفق",
  unreachable: "در دسترس نیست",
};

/**
 * Grants access if the token matches OR the caller is authenticated as the
 * assessment owner (persistent login cookie) or staff. Mirrors
 * assertResultAccess so a logged-in user who lost their local/URL token can
 * still submit — matching how they can already view their result/report
 * without one.
 */
function assertConsultationAccess(params: {
  ownerId: string;
  expectedToken: string;
  token?: string;
  access: ResultAccessInput;
}): void {
  const { ownerId, expectedToken, token, access } = params;

  if (access.adminSession || access.salesExpertSession) {
    return;
  }

  if (token && token === expectedToken) {
    return;
  }

  if (access.userSession && access.userSession.userId === ownerId) {
    return;
  }

  throw new AppError(
    "report_access_denied",
    "Invalid or missing access token",
    403,
  );
}

export async function submitConsultationRequest(
  body: unknown,
  access: ResultAccessInput = {},
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
    assertConsultationAccess({
      ownerId: assessment.userId,
      expectedToken: assessment.resultToken,
      token: validated.token,
      access,
    });
  }

  if (validated.reportId) {
    const report = await findReportById(validated.reportId);
    if (!report) {
      throw new AppError("report_not_found", "Report not found", 404);
    }
    assertConsultationAccess({
      ownerId: report.assessmentSession.userId,
      expectedToken: report.assessmentSession.resultToken,
      token: validated.token,
      access,
    });
  }

  const { token: _token, ...input } = validated;

  let record: { id: string; createdAt: Date };

  if (validated.assessmentSessionId) {
    const existing = await findConsultationRequestByAssessmentSessionId(
      validated.assessmentSessionId,
    );
    if (existing) {
      record = await upgradeExistingLeadToDirect(existing.id, input);
    } else {
      record = await createConsultationRequest(
        input satisfies CreateConsultationRequestInput,
      );
      await finalizeNewLead(record.id, {
        assessmentSessionId: validated.assessmentSessionId,
        mode: "immediate",
      });
    }
  } else {
    record = await createConsultationRequest(
      input satisfies CreateConsultationRequestInput,
    );
    await finalizeNewLead(record.id, {
      assessmentSessionId: validated.assessmentSessionId,
      mode: "immediate",
    });
  }

  if (validated.assessmentSessionId) {
    const assessment = await findAssessmentById(validated.assessmentSessionId);
    if (assessment?.userId) {
      hookConsultationSubmitted(assessment.userId, validated.assessmentSessionId);
    }
  }

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

function mapLeadMetadata(row: ConsultationRow) {
  const effective = resolveEffectivePurchaseProbability({
    purchaseProbabilityPercent: row.purchaseProbabilityPercent,
    purchaseProbabilityBand: row.purchaseProbabilityBand,
    adminProbabilityOverridePercent: row.adminProbabilityOverridePercent,
  });

  return {
    source: row.source,
    sourceLabel: LEAD_SOURCE_LABELS[row.source],
    purchaseProbabilityPercent: effective.percent,
    purchaseProbabilityLabel: formatPurchaseProbabilityLabel(
      effective.percent,
      effective.band,
    ),
    adminProbabilityOverridePercent: row.adminProbabilityOverridePercent,
  };
}

function mapLeadAssignmentState(row: ConsultationRow) {
  const assignScheduledFor = row.assignScheduledFor
    ? formatConsultationDate(row.assignScheduledFor)
    : null;
  const pendingAssignment =
    row.source === "system" &&
    row.assignedToId == null &&
    row.assignScheduledFor != null;

  return { assignScheduledFor, pendingAssignment };
}

function mapLeadSla(row: ConsultationRow) {
  const sla = computeLeadSlaFlags({
    status: row.status,
    createdAt: row.createdAt,
    nextFollowUpAt: row.nextFollowUpAt,
    assignedToId: row.assignedToId,
    purchaseProbabilityBand: row.purchaseProbabilityBand,
  });

  return {
    sla,
    slaReason: slaReasonLabel(sla),
  };
}

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
    ...mapLeadMetadata(row),
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
    ...mapLeadAssignmentState(row),
    ...mapLeadSla(row),
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

function buildLeadTimeline(row: ConsultationDetailRow): LeadTimelineEntry[] {
  const entries: LeadTimelineEntry[] = [];

  for (const note of row.consultationNotes) {
    entries.push({
      id: `note-${note.id}`,
      kind: "note",
      label: "یادداشت",
      detail: note.body,
      authorName: note.staffUser.name,
      createdAt: formatConsultationDate(note.createdAt),
      createdAtIso: note.createdAt.toISOString(),
    });
  }

  for (const activity of row.leadActivities) {
    if (activity.type === "note_added") {
      continue;
    }

    entries.push({
      id: activity.id,
      kind: "activity",
      label: LEAD_ACTIVITY_LABELS[activity.type],
      detail: formatActivityDetail(activity.type, activity.detail),
      authorName: activity.staffUser?.name ?? null,
      createdAt: formatConsultationDate(activity.createdAt),
      createdAtIso: activity.createdAt.toISOString(),
      activityType: activity.type,
    });
  }

  return entries.sort(
    (left, right) =>
      new Date(right.createdAtIso).getTime() -
      new Date(left.createdAtIso).getTime(),
  );
}

function resolveStatusTimestamps(
  existing: {
    status: LeadStatus;
    firstContactedAt: Date | null;
    closedAt: Date | null;
  },
  newStatus: LeadStatus | undefined,
): { firstContactedAt?: Date; closedAt?: Date } {
  if (newStatus === undefined || newStatus === existing.status) {
    return {};
  }

  const updates: { firstContactedAt?: Date; closedAt?: Date } = {};
  const now = new Date();

  if (newStatus === "contacted" && !existing.firstContactedAt) {
    updates.firstContactedAt = now;
  }

  if (
    (newStatus === "closed_won" || newStatus === "closed_lost") &&
    !existing.closedAt
  ) {
    updates.closedAt = now;
  }

  return updates;
}

async function recordLeadUpdateActivities(params: {
  consultationRequestId: string;
  staffUserId: string | null;
  existing: {
    status: LeadStatus;
    assignedToId: string | null;
    nextFollowUpAt: Date | null;
    adminProbabilityOverridePercent: number | null;
  };
  input: UpdateConsultationLeadInput;
}): Promise<void> {
  const { consultationRequestId, staffUserId, existing, input } = params;

  if (input.status !== undefined && input.status !== existing.status) {
    await createLeadActivity({
      consultationRequestId,
      staffUserId,
      type: "status_change",
      detail: `${existing.status}→${input.status}`,
    });
  }

  if (
    input.assignedToId !== undefined &&
    input.assignedToId !== existing.assignedToId
  ) {
    await createLeadActivity({
      consultationRequestId,
      staffUserId,
      type: "assignment_change",
      detail: input.assignedToId ?? "unassigned",
    });
  }

  if (
    input.adminProbabilityOverridePercent !== undefined &&
    input.adminProbabilityOverridePercent !==
      existing.adminProbabilityOverridePercent
  ) {
    await createLeadActivity({
      consultationRequestId,
      staffUserId,
      type: "probability_override",
      detail:
        input.adminProbabilityOverridePercent == null
          ? "cleared"
          : String(input.adminProbabilityOverridePercent),
    });
  }

  if (input.nextFollowUpAt !== undefined) {
    const existingIso = existing.nextFollowUpAt?.toISOString() ?? null;
    const inputIso = input.nextFollowUpAt?.toISOString() ?? null;
    if (existingIso !== inputIso) {
      await createLeadActivity({
        consultationRequestId,
        staffUserId,
        type: "follow_up_set",
        detail: input.nextFollowUpAt
          ? input.nextFollowUpAt.toISOString()
          : "cleared",
      });
    }
  }
}

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
    ...mapLeadMetadata(row),
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
    timeline: buildLeadTimeline(row),
    ...mapLeadAssignmentState(row),
    ...mapLeadSla(row),
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

  if (
    !isAdminAccess(access) &&
    input.adminProbabilityOverridePercent !== undefined
  ) {
    throw new AppError(
      "FORBIDDEN",
      "فقط ادمین می‌تواند احتمال خرید را بازنویسی کند.",
      403,
    );
  }

  const staffUserId =
    access.adminSession?.staffUserId ??
    access.salesExpertSession?.staffUserId ??
    null;

  const timestampUpdates = resolveStatusTimestamps(existing, input.status);

  const updated = await updateConsultationLead(id, {
    ...input,
    ...timestampUpdates,
  });

  await recordLeadUpdateActivities({
    consultationRequestId: id,
    staffUserId,
    existing: {
      status: existing.status,
      assignedToId: existing.assignedToId,
      nextFollowUpAt: existing.nextFollowUpAt,
      adminProbabilityOverridePercent: existing.adminProbabilityOverridePercent,
    },
    input,
  });

  return toConsultationListItem(updated);
}

function requireAdminAccess(access: ConsultationsAccessInput): void {
  if (!isAdminAccess(access)) {
    throw new AppError(
      "FORBIDDEN",
      "فقط ادمین به این عملیات دسترسی دارد.",
      403,
    );
  }
}

export async function bulkUpdateLeads(
  input: BulkUpdateLeadsInput,
  access: ConsultationsAccessInput,
): Promise<{ updated: number }> {
  requireConsultationsAccess(access);
  requireAdminAccess(access);

  const staffUserId = access.adminSession?.staffUserId ?? null;
  const existingRows = await findConsultationRequestsByIds(input.ids);
  let updated = 0;

  for (const row of existingRows) {
    const updateInput: UpdateConsultationLeadInput = {};
    const timestampUpdates = resolveStatusTimestamps(row, input.status);

    if (input.status !== undefined) {
      updateInput.status = input.status;
    }

    if (input.assignedToId !== undefined) {
      updateInput.assignedToId = input.assignedToId;
    }

    if (
      updateInput.status === undefined &&
      updateInput.assignedToId === undefined
    ) {
      continue;
    }

    await updateConsultationLead(row.id, {
      ...updateInput,
      ...timestampUpdates,
    });

    await recordLeadUpdateActivities({
      consultationRequestId: row.id,
      staffUserId,
      existing: {
        status: row.status,
        assignedToId: row.assignedToId,
        nextFollowUpAt: row.nextFollowUpAt,
        adminProbabilityOverridePercent: row.adminProbabilityOverridePercent,
      },
      input: updateInput,
    });

    updated += 1;
  }

  return { updated };
}

export async function createManualLead(
  input: CreateManualLeadInput,
  access: ConsultationsAccessInput,
): Promise<ConsultationListItem> {
  requireConsultationsAccess(access);
  requireAdminAccess(access);

  const staffUserId = access.adminSession?.staffUserId ?? null;
  const record = await createManualConsultationRequest(input);

  await createLeadActivity({
    consultationRequestId: record.id,
    staffUserId,
    type: "created",
    detail: "manual",
  });

  return toConsultationListItem(record);
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function exportLeadsToCsv(
  filter: ConsultationListFilter,
  access: ConsultationsAccessInput,
): Promise<string> {
  requireConsultationsAccess(access);
  requireAdminAccess(access);

  const effectiveFilter = resolveListFilter(filter, access);
  const { page: _page, pageSize: _pageSize, ...listFilter } = effectiveFilter;
  const rows = await findAllConsultationRequests(listFilter);

  const headers = [
    "نام",
    "موبایل",
    "ایمیل",
    "وضعیت",
    "منبع",
    "احتمال خرید",
    "کارشناس",
    "کسب‌وکار",
    "تاریخ ثبت",
    "پیام",
  ];

  const lines = rows.map((row) => {
    const item = toConsultationListItem(row);
    return [
      item.name,
      item.phone ?? item.assessmentUserPhone ?? "",
      item.email ?? "",
      item.statusLabel,
      item.sourceLabel,
      item.purchaseProbabilityLabel ?? "",
      item.pendingAssignment ? "در صف تخصیص" : (item.assignedToName ?? ""),
      item.businessName ?? "",
      item.createdAt,
      item.message ?? "",
    ]
      .map((cell) => escapeCsvField(cell))
      .join(",");
  });

  return `\uFEFF${headers.join(",")}\n${lines.join("\n")}`;
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

  await createLeadActivity({
    consultationRequestId: id,
    staffUserId,
    type: "note_added",
    detail: body.trim().slice(0, 500),
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
