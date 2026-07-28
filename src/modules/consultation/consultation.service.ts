import type { LeadStatus, LostReason } from "@prisma/client";
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
  claimLeadIfUnassignedUnderCapacity,
  countConsultationRequests,
  countFollowUpsDueInRange,
  countOverdueFollowUps,
  createConsultationRequest,
  createLeadActivity,
  createLeadCallLog,
  createManualConsultationRequest,
  findAllConsultationRequests,
  findConsultationNotes,
  findConsultationRequestByAssessmentSessionId,
  findConsultationRequestByUserId,
  findConsultationRequestById,
  findConsultationRequests,
  findConsultationRequestsByIds,
  findConsultationRequestsForKanban,
  findFollowUpsDueInRange,
  findNewLeadsForDashboard,
  findOverdueFollowUps,
  updateConsultationLead,
} from "./consultation.repository";
import type {
  LogCallInput,
  TransferLeadInput,
  UpdateConsultationLeadInput,
} from "./consultation-lead.validators";
import type {
  BulkUpdateLeadsInput,
  ConsultationLeadDetail,
  ConsultationLeadSmsHistory,
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
import { SEQUENCE_LABELS } from "@/modules/sms-funnel/funnel-config.service";
import { listLeadSmsHistory } from "@/modules/sms-funnel/funnel.repository";
import { hookConsultationSubmitted } from "@/modules/sms-funnel/hooks";
import type { SequenceKey } from "@/modules/sms-funnel/sequences";
import { recordConversionFunnelEvent } from "@/modules/funnel/conversion-events";
import {
  formatPurchaseProbabilityLabel,
  LEAD_SOURCE_LABELS,
  resolveEffectivePurchaseProbability,
} from "./lead-insights";
import {
  finalizeNewLead,
  notifyLeadTransferToExpert,
  upgradeExistingLeadToDirect,
} from "./lead-assignment.service";
import {
  CALL_OUTCOME_LABELS,
  formatActivityDetail,
  formatTransferNoteBody,
  LEAD_ACTIVITY_LABELS,
  LOST_REASON_LABELS,
  serializeAssignmentChangeDetail,
  serializeCallLoggedDetail,
} from "./lead-activity";
import { getLeadSettings } from "./lead-config.service";
import {
  computeLeadSlaFlags,
  slaReasonLabel,
  STALE_NEW_LEAD_HOURS,
} from "./lead-sla";
import { isManualStatusTransitionAllowed } from "./lead-status";
import { findStaffUserById } from "@/modules/staff/staff.repository";

const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  assessment_in_progress: "در حال انجام تست",
  assessment_incomplete: "پیگیری تکمیل تست",
  assessment_completed: "تست تکمیل‌شده",
  new: "درخواست مشاوره",
  contacted: "تماس گرفته‌شده",
  meeting_scheduled: "جلسه تنظیم‌شده",
  closed_won: "بسته — موفق",
  closed_lost: "بسته — ناموفق",
  unreachable: "در دسترس نیست",
};

const SMS_STATUS_LABELS: Record<string, string> = {
  pending: "در صف",
  sent: "ارسال‌شده",
  failed: "ناموفق",
  canceled: "لغو شده",
  skipped: "رد شده",
};

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  active: "فعال",
  completed: "تکمیل‌شده",
  stopped: "متوقف",
  converted: "تبدیل‌شده",
};

function sequenceLabel(sequenceKey: string): string {
  return SEQUENCE_LABELS[sequenceKey as SequenceKey] ?? sequenceKey;
}

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
    const assessment = await findAssessmentById(validated.assessmentSessionId);
    const existing =
      (await findConsultationRequestByAssessmentSessionId(
        validated.assessmentSessionId,
      )) ??
      (assessment
        ? await findConsultationRequestByUserId(assessment.userId)
        : null);
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
      recordConversionFunnelEvent({
        userId: assessment.userId,
        assessmentSessionId: validated.assessmentSessionId,
        type: "consultation_submitted",
      });
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

  if (filter.onlyTeamQueue) {
    return {
      ...filter,
      onlyTeamQueue: true,
      onlyUnassigned: true,
      assignedToId: undefined,
      onlyMine: false,
    };
  }

  return { ...filter, assignedToId: staffUserId, onlyUnassigned: false };
}

/** Read access: admin, owner, or unassigned team-queue preview for experts. */
function canAccessLead(
  assignedToId: string | null,
  access: ConsultationsAccessInput,
): boolean {
  if (isAdminAccess(access)) {
    return true;
  }

  const staffUserId = access.salesExpertSession?.staffUserId;
  if (!staffUserId) {
    return false;
  }

  if (assignedToId === staffUserId) {
    return true;
  }

  // Team-queue preview: active sales experts may read unassigned leads.
  return assignedToId === null;
}

/** Mutation access: admin or current owner only (not unassigned queue). */
function canMutateLead(
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

function assertLeadOwnership(
  assignedToId: string | null,
  access: ConsultationsAccessInput,
): void {
  if (!canMutateLead(assignedToId, access)) {
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

function mapLeadCallState(row: {
  lastCallOutcome: ConsultationRow["lastCallOutcome"];
  lastCalledAt: ConsultationRow["lastCalledAt"];
}) {
  return {
    lastCallOutcome: row.lastCallOutcome,
    lastCallOutcomeLabel: row.lastCallOutcome
      ? CALL_OUTCOME_LABELS[row.lastCallOutcome]
      : null,
    lastCalledAt: row.lastCalledAt
      ? formatConsultationDate(row.lastCalledAt)
      : null,
  };
}

function mapLeadLostState(row: {
  lostReason: ConsultationRow["lostReason"];
  lostNote: ConsultationRow["lostNote"];
}) {
  return {
    lostReason: row.lostReason,
    lostReasonLabel: row.lostReason
      ? LOST_REASON_LABELS[row.lostReason]
      : null,
    lostNote: row.lostNote,
  };
}

function resolveLostReasonUpdates(
  existing: {
    status: LeadStatus;
    lostReason: LostReason | null;
    lostNote: string | null;
  },
  input: UpdateConsultationLeadInput,
): { lostReason?: LostReason; lostNote?: string | null } {
  const nextStatus = input.status ?? existing.status;
  const updates: {
    lostReason?: LostReason;
    lostNote?: string | null;
  } = {};

  if (input.status === "closed_lost" && input.lostReason === undefined) {
    throw new AppError(
      "VALIDATION_ERROR",
      "برای بستن ناموفق، دلیل باخت الزامی است.",
      400,
      { field: "lostReason" },
    );
  }

  if (
    (input.lostReason !== undefined || input.lostNote !== undefined) &&
    nextStatus !== "closed_lost"
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "دلیل باخت فقط برای وضعیت بسته — ناموفق مجاز است.",
      400,
      { field: "lostReason" },
    );
  }

  if (input.lostReason !== undefined) {
    updates.lostReason = input.lostReason;
    if (input.lostReason !== "other") {
      updates.lostNote = null;
    } else if (input.lostNote !== undefined) {
      updates.lostNote = input.lostNote;
    }
  } else if (input.lostNote !== undefined) {
    if (existing.lostReason !== "other") {
      throw new AppError(
        "VALIDATION_ERROR",
        "یادداشت باخت فقط برای دلیل «سایر» مجاز است.",
        400,
        { field: "lostNote" },
      );
    }
    updates.lostNote = input.lostNote;
  }

  return updates;
}

function mapLeadSla(
  row: ConsultationRow,
  staleNewLeadHours: number = STALE_NEW_LEAD_HOURS,
) {
  const sla = computeLeadSlaFlags(
    {
      status: row.status,
      createdAt: row.createdAt,
      nextFollowUpAt: row.nextFollowUpAt,
      assignedToId: row.assignedToId,
      purchaseProbabilityBand: row.purchaseProbabilityBand,
    },
    staleNewLeadHours,
  );

  return {
    sla,
    slaReason: slaReasonLabel(sla),
  };
}

function toConsultationListItem(
  row: ConsultationRow,
  staleNewLeadHours: number = STALE_NEW_LEAD_HOURS,
): ConsultationListItem {
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
    ...mapLeadCallState(row),
    ...mapLeadLostState(row),
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
    ...mapLeadSla(row, staleNewLeadHours),
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

  if (
    (newStatus === "contacted" || newStatus === "meeting_scheduled") &&
    !existing.firstContactedAt
  ) {
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
    const fromId = existing.assignedToId;
    const toId = input.assignedToId;
    const [fromUser, toUser] = await Promise.all([
      fromId ? findStaffUserById(fromId) : Promise.resolve(null),
      toId ? findStaffUserById(toId) : Promise.resolve(null),
    ]);

    await createLeadActivity({
      consultationRequestId,
      staffUserId,
      type: "assignment_change",
      detail: serializeAssignmentChangeDetail({
        fromId,
        toId,
        fromName: fromUser?.name ?? null,
        toName: toUser?.name ?? null,
      }),
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

async function syncCallScheduledSmsForFollowUp(params: {
  assessmentSessionId: string | null;
  userId: string | null | undefined;
  existingNextFollowUpAt: Date | null;
  nextFollowUpAt: Date | null | undefined;
}): Promise<void> {
  const { nextFollowUpAt } = params;
  if (nextFollowUpAt === undefined || nextFollowUpAt === null) return;

  const existingIso = params.existingNextFollowUpAt?.toISOString() ?? null;
  if (existingIso === nextFollowUpAt.toISOString()) return;

  const userId = params.userId;
  if (!userId) return;

  try {
    const { rescheduleCallScheduledForFollowUp } = await import(
      "@/modules/sms-funnel/enrollment.service"
    );
    await rescheduleCallScheduledForFollowUp({
      userId,
      assessmentSessionId: params.assessmentSessionId,
      nextFollowUpAt,
    });
  } catch (error) {
    console.error(
      "[sms-funnel] call-scheduled follow-up reschedule failed:",
      error,
    );
  }
}

function toConsultationLeadDetail(
  row: ConsultationDetailRow,
  staleNewLeadHours: number = STALE_NEW_LEAD_HOURS,
): ConsultationLeadDetail {
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
    ...mapLeadCallState(row),
    ...mapLeadLostState(row),
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
    ...mapLeadSla(row, staleNewLeadHours),
  };
}

function applyStaleNewListFilter<
  T extends {
    onlyStaleNew?: boolean;
    status?: ConsultationListFilter["status"];
    createdTo?: Date;
  },
>(filter: T, staleNewLeadHours: number): T {
  if (!filter.onlyStaleNew) {
    return filter;
  }

  const hours =
    Number.isFinite(staleNewLeadHours) && staleNewLeadHours > 0
      ? staleNewLeadHours
      : STALE_NEW_LEAD_HOURS;
  const staleBefore = new Date(Date.now() - hours * 60 * 60 * 1000);
  const createdTo =
    filter.createdTo && filter.createdTo.getTime() < staleBefore.getTime()
      ? filter.createdTo
      : staleBefore;

  return {
    ...filter,
    status: filter.status ?? "new",
    createdTo,
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

  const settingsPromise = getLeadSettings();
  const settingsForFilter = effectiveFilter.onlyStaleNew
    ? await settingsPromise
    : null;
  const queryFilter = settingsForFilter
    ? applyStaleNewListFilter(
        effectiveFilter,
        settingsForFilter.staleNewLeadHours,
      )
    : effectiveFilter;

  const [total, requests, settings] = await Promise.all([
    countConsultationRequests(queryFilter),
    findConsultationRequests(queryFilter),
    settingsPromise,
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / filter.pageSize);
  const staleNewLeadHours = settings.staleNewLeadHours;

  return {
    requests: requests.map((row) =>
      toConsultationListItem(row, staleNewLeadHours),
    ),
    pagination: {
      page: filter.page,
      pageSize: filter.pageSize,
      total,
      totalPages,
    },
  };
}

/** Kanban board: all matching leads with lean payload (no 100-row cap). */
export async function listConsultationRequestsForKanban(
  filter: Omit<ConsultationListFilter, "page" | "pageSize">,
  access?: ConsultationsAccessInput,
): Promise<ConsultationListResponse> {
  const baseFilter: ConsultationListFilter = {
    ...filter,
    page: 1,
    pageSize: 1,
  };
  const effectiveFilter = access
    ? resolveListFilter(baseFilter, access)
    : baseFilter;

  if (effectiveFilter.assignedToId === "__none__") {
    return {
      requests: [],
      pagination: {
        page: 1,
        pageSize: 0,
        total: 0,
        totalPages: 0,
      },
    };
  }

  const { page: _page, pageSize: _pageSize, ...listFilter } = effectiveFilter;
  const settingsPromise = getLeadSettings();
  const settingsForFilter = listFilter.onlyStaleNew
    ? await settingsPromise
    : null;
  const queryFilter = settingsForFilter
    ? applyStaleNewListFilter(listFilter, settingsForFilter.staleNewLeadHours)
    : listFilter;

  const [requests, settings] = await Promise.all([
    findConsultationRequestsForKanban(queryFilter),
    settingsPromise,
  ]);
  const total = requests.length;
  const staleNewLeadHours = settings.staleNewLeadHours;

  return {
    requests: requests.map((row) =>
      toConsultationListItem(row, staleNewLeadHours),
    ),
    pagination: {
      page: 1,
      pageSize: total,
      total,
      totalPages: total === 0 ? 0 : 1,
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
  const settings = await getLeadSettings();
  return toConsultationLeadDetail(row, settings.staleNewLeadHours);
}

export async function getConsultationLeadSmsHistory(
  id: string,
  access: ConsultationsAccessInput,
): Promise<ConsultationLeadSmsHistory> {
  requireConsultationsAccess(access);

  const row = await findConsultationRequestById(id);
  if (!row) {
    throw new AppError("NOT_FOUND", "لید یافت نشد.", 404, { id });
  }

  assertLeadAccess(row.assignedToId, access);

  const phones = [
    row.phone,
    row.assessmentSession?.user.phone ?? null,
  ].filter((phone): phone is string => Boolean(phone));

  const history = await listLeadSmsHistory({
    phones,
    assessmentSessionId: row.assessmentSessionId,
  });

  return {
    activeEnrollments: history.activeEnrollments.map((enrollment) => ({
      id: enrollment.id,
      sequenceKey: enrollment.sequenceKey,
      sequenceLabel: sequenceLabel(enrollment.sequenceKey),
      currentStep: enrollment.currentStep,
      status: enrollment.status,
      statusLabel:
        ENROLLMENT_STATUS_LABELS[enrollment.status] ?? enrollment.status,
      messagesSentCount: enrollment.messagesSentCount,
      lastEventAt: formatConsultationDate(enrollment.lastEventAt),
    })),
    messages: history.messages.map((message) => ({
      id: message.id,
      phone: message.phone,
      sequenceKey: message.sequenceKey,
      sequenceLabel: sequenceLabel(message.sequenceKey),
      stepKey: message.stepKey,
      status: message.status,
      statusLabel: SMS_STATUS_LABELS[message.status] ?? message.status,
      scheduledFor: formatConsultationDate(message.scheduledFor),
      sentAt: message.sentAt ? formatConsultationDate(message.sentAt) : null,
      createdAt: formatConsultationDate(message.createdAt),
    })),
  };
}

export async function transferLead(
  id: string,
  input: TransferLeadInput,
  access: ConsultationsAccessInput,
): Promise<ConsultationListItem> {
  requireConsultationsAccess(access);

  const staffUserId =
    access.adminSession?.staffUserId ??
    access.salesExpertSession?.staffUserId ??
    null;

  if (!staffUserId) {
    throw new AppError(
      "FORBIDDEN",
      "برای انتقال لید باید با حساب کاربری داخلی وارد شده باشید.",
      403,
    );
  }

  const existing = await findConsultationRequestById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", "لید یافت نشد.", 404, { id });
  }

  assertLeadOwnership(existing.assignedToId, access);

  if (
    !isAdminAccess(access) &&
    existing.assignedToId !== access.salesExpertSession?.staffUserId
  ) {
    throw new AppError(
      "FORBIDDEN",
      "فقط مالک فعلی لید می‌تواند آن را منتقل کند.",
      403,
    );
  }

  if (input.toStaffUserId === existing.assignedToId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "لید هم‌اکنون به این کارشناس تخصیص داده شده است.",
      400,
      { field: "toStaffUserId" },
    );
  }

  if (input.toStaffUserId === staffUserId && !isAdminAccess(access)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "انتقال لید به خودتان مجاز نیست.",
      400,
      { field: "toStaffUserId" },
    );
  }

  const toUser = await findStaffUserById(input.toStaffUserId);
  if (
    !toUser ||
    toUser.role !== "sales_expert" ||
    !toUser.isActive
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "کارشناس مقصد نامعتبر یا غیرفعال است.",
      400,
      { field: "toStaffUserId" },
    );
  }

  const fromUser = existing.assignedToId
    ? await findStaffUserById(existing.assignedToId)
    : null;

  const actorName =
    access.adminSession?.name ??
    access.salesExpertSession?.name ??
    fromUser?.name ??
    "سیستم";

  const updated = await updateConsultationLead(id, {
    assignedToId: input.toStaffUserId,
  });

  await createLeadActivity({
    consultationRequestId: id,
    staffUserId,
    type: "assignment_change",
    detail: serializeAssignmentChangeDetail({
      fromId: existing.assignedToId,
      toId: input.toStaffUserId,
      fromName: fromUser?.name ?? null,
      toName: toUser.name,
      reason: input.reason,
    }),
  });

  const transferNoteBody = formatTransferNoteBody(input.reason, input.note);
  await addConsultationNote({
    consultationRequestId: id,
    staffUserId,
    body: transferNoteBody,
  });
  await createLeadActivity({
    consultationRequestId: id,
    staffUserId,
    type: "note_added",
    detail: transferNoteBody.slice(0, 500),
  });

  await notifyLeadTransferToExpert({
    leadId: id,
    leadName: existing.name,
    toStaffUserId: input.toStaffUserId,
    fromName: actorName,
  });

  const settings = await getLeadSettings();
  return toConsultationListItem(updated, settings.staleNewLeadHours);
}

export async function claimLead(
  id: string,
  access: ConsultationsAccessInput,
): Promise<ConsultationListItem> {
  requireConsultationsAccess(access);

  const staffUserId = access.salesExpertSession?.staffUserId ?? null;
  if (!staffUserId) {
    throw new AppError(
      "FORBIDDEN",
      "فقط کارشناس فروش می‌تواند سرنخ را از صف تیم بردارد.",
      403,
    );
  }

  const expert = await findStaffUserById(staffUserId);
  if (!expert || expert.role !== "sales_expert" || !expert.isActive) {
    throw new AppError(
      "FORBIDDEN",
      "حساب کارشناس فروش فعال برای برداشتن سرنخ لازم است.",
      403,
    );
  }

  const existing = await findConsultationRequestById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", "لید یافت نشد.", 404, { id });
  }

  if (existing.assignedToId !== null) {
    throw new AppError(
      "CONFLICT",
      "این لید قبلاً تخصیص داده شده و قابل برداشتن نیست.",
      409,
    );
  }

  if (
    existing.status === "closed_won" ||
    existing.status === "closed_lost"
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "لید بسته‌شده قابل برداشتن از صف تیم نیست.",
      400,
    );
  }

  const settings = await getLeadSettings();
  const claimResult = await claimLeadIfUnassignedUnderCapacity(
    id,
    staffUserId,
    settings.maxOpenLeadsPerExpert,
  );

  if (claimResult === "at_capacity") {
    throw new AppError(
      "VALIDATION_ERROR",
      "ظرفیت لیدهای باز شما تکمیل است؛ ابتدا چند لید را ببندید یا منتقل کنید.",
      400,
    );
  }

  if (claimResult === "already_assigned") {
    throw new AppError(
      "CONFLICT",
      "این لید هم‌اکنون توسط کارشناس دیگری برداشته شد.",
      409,
    );
  }

  if (claimResult === "not_claimable") {
    throw new AppError(
      "VALIDATION_ERROR",
      "این لید قابل برداشتن از صف تیم نیست.",
      400,
    );
  }

  await createLeadActivity({
    consultationRequestId: id,
    staffUserId,
    type: "assignment_change",
    detail: serializeAssignmentChangeDetail({
      fromId: null,
      toId: staffUserId,
      fromName: null,
      toName: expert.name,
    }),
  });

  const updated = await findConsultationRequestById(id);
  if (!updated) {
    throw new AppError("NOT_FOUND", "لید یافت نشد.", 404, { id });
  }

  return toConsultationListItem(updated, settings.staleNewLeadHours);
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

  assertLeadOwnership(existing.assignedToId, access);

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

  if (
    input.status !== undefined &&
    input.status !== existing.status &&
    !isManualStatusTransitionAllowed(existing.status, input.status)
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "ورود دستی به وضعیت «در حال انجام تست» مجاز نیست.",
      400,
    );
  }

  const staffUserId =
    access.adminSession?.staffUserId ??
    access.salesExpertSession?.staffUserId ??
    null;

  const timestampUpdates = resolveStatusTimestamps(existing, input.status);
  const lostUpdates = resolveLostReasonUpdates(existing, input);

  const updated = await updateConsultationLead(id, {
    ...input,
    ...timestampUpdates,
    ...lostUpdates,
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

  await syncCallScheduledSmsForFollowUp({
    assessmentSessionId: existing.assessmentSessionId,
    userId: existing.assessmentSession?.userId ?? existing.assessmentSession?.user?.id,
    existingNextFollowUpAt: existing.nextFollowUpAt,
    nextFollowUpAt: input.nextFollowUpAt,
  });

  const settings = await getLeadSettings();
  return toConsultationListItem(updated, settings.staleNewLeadHours);
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
      if (
        input.status !== row.status &&
        !isManualStatusTransitionAllowed(row.status, input.status)
      ) {
        continue;
      }
      updateInput.status = input.status;
    }

    if (input.assignedToId !== undefined) {
      updateInput.assignedToId = input.assignedToId;
    }

    if (input.lostReason !== undefined) {
      updateInput.lostReason = input.lostReason;
    }

    if (input.lostNote !== undefined) {
      updateInput.lostNote = input.lostNote;
    }

    if (
      updateInput.status === undefined &&
      updateInput.assignedToId === undefined &&
      updateInput.lostReason === undefined &&
      updateInput.lostNote === undefined
    ) {
      continue;
    }

    const lostUpdates = resolveLostReasonUpdates(row, updateInput);

    await updateConsultationLead(row.id, {
      ...updateInput,
      ...timestampUpdates,
      ...lostUpdates,
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

  assertLeadOwnership(existing.assignedToId, access);

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

export async function logCall(
  id: string,
  input: LogCallInput,
  access: ConsultationsAccessInput,
): Promise<ConsultationListItem> {
  requireConsultationsAccess(access);

  const staffUserId =
    access.adminSession?.staffUserId ??
    access.salesExpertSession?.staffUserId ??
    null;

  if (!staffUserId) {
    throw new AppError(
      "FORBIDDEN",
      "برای ثبت تماس باید با حساب کاربری داخلی وارد شده باشید.",
      403,
    );
  }

  const existing = await findConsultationRequestById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", "لید یافت نشد.", 404, { id });
  }

  assertLeadOwnership(existing.assignedToId, access);

  const calledAt = new Date();
  const note = input.note?.trim() || null;

  await createLeadCallLog({
    consultationRequestId: id,
    staffUserId,
    outcome: input.outcome,
    note,
  });

  const updated = await updateConsultationLead(id, {
    lastCallOutcome: input.outcome,
    lastCalledAt: calledAt,
  });

  await createLeadActivity({
    consultationRequestId: id,
    staffUserId,
    type: "call_logged",
    detail: serializeCallLoggedDetail(input.outcome, note),
  });

  const settings = await getLeadSettings();
  return toConsultationListItem(updated, settings.staleNewLeadHours);
}

export function leadStatusLabel(status: LeadStatus): string {
  return LEAD_STATUS_LABELS[status];
}

function endOfDay(date = new Date()): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function toFollowUpRow(
  row: ConsultationRow,
  staleNewLeadHours: number = STALE_NEW_LEAD_HOURS,
): ExpertDashboardFollowUpRow {
  const item = toConsultationListItem(row, staleNewLeadHours);
  return {
    id: item.id,
    name: item.name,
    businessName: item.businessName,
    statusLabel: item.statusLabel,
    nextFollowUpAt: item.nextFollowUpAt,
    detailUrl: item.detailUrl,
    assignedToName: item.assignedToName,
    isStaleNew: item.sla.staleNew,
  };
}

/** When `staffUserId` is omitted, KPIs/lists are team-wide (admin expert view). */
export async function getExpertDashboard(
  staffUserId?: string,
): Promise<ExpertDashboardData> {
  const now = new Date();
  const endOfToday = endOfDay(now);
  const settings = await getLeadSettings();
  const staleNewLeadHours = settings.staleNewLeadHours;
  const baseFilter = {
    ...(staffUserId ? { assignedToId: staffUserId } : {}),
    page: 1,
    pageSize: 1,
  };

  const [
    overdueFollowUp,
    followUpDueToday,
    newLeadsCount,
    teamQueue,
    overdueRows,
    todayRows,
    newLeadRows,
  ] = await Promise.all([
    countOverdueFollowUps(staffUserId, now),
    countFollowUpsDueInRange(staffUserId, now, endOfToday),
    countConsultationRequests({ ...baseFilter, status: "new" }),
    countConsultationRequests({
      onlyTeamQueue: true,
      page: 1,
      pageSize: 1,
    }),
    findOverdueFollowUps(staffUserId, now, 10),
    findFollowUpsDueInRange(staffUserId, now, endOfToday, 10),
    findNewLeadsForDashboard(staffUserId, 10),
  ]);

  return {
    kpis: {
      overdueFollowUp,
      followUpDueToday,
      newLeads: newLeadsCount,
      teamQueue,
    },
    overdueFollowUps: overdueRows.map((row) =>
      toFollowUpRow(row, staleNewLeadHours),
    ),
    todayFollowUps: todayRows.map((row) =>
      toFollowUpRow(row, staleNewLeadHours),
    ),
    newLeadRows: newLeadRows.map((row) =>
      toFollowUpRow(row, staleNewLeadHours),
    ),
  };
}
