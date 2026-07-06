import type { AssessmentStatus, LeadStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { verifyConfiguredPassword } from "@/lib/password-auth";
import type { AdminSession } from "@/lib/session";
import {
  countAssessmentsForAdmin,
  countAssessmentsByDateRange,
  countUsersVerifiedSince,
  countUsersStartedInRange,
  countUsersCompletedInRange,
  countUsersWithConsultation,
  countUsersWithNewConsultation,
  countUsersCriticalLeads,
  countUsersStartedAllTime,
  countUsersCompletedAllTime,
  findAssessmentForAdmin,
  findAssessmentsForAdmin,
  findActiveSalesExperts,
  groupLeadsByAssignee,
  countLeadsByStatus,
  countPendingAssignmentLeads,
  countOverdueFollowUps,
  countStaleNewLeads,
  countHighProbabilityUnassigned,
  countLeadsCreatedInRange,
  groupLeadsBySource,
  groupLeadsBySourceAndStatus,
  findLeadsWithFirstContact,
  findLeadsWithClose,
  countOverdueFollowUpsByAssignee,
  countNewLeadsThisWeekByAssignee,
  findUrgentLeads,
  STALE_NEW_LEAD_HOURS,
  startOfMonth,
  startOfWeek,
} from "./admin.repository";
import { healthLevelLabelFa } from "@/lib/health-level";
import type {
  AdminAssessmentDetail,
  AdminAssessmentFilter,
  AdminAssessmentListItem,
  AdminAssessmentsResponse,
  AdminDashboardData,
  AdminExpertPerformanceRow,
  AdminLeadStatusFunnel,
  AdminLeadSourceBreakdown,
  AdminLeadSourceConversionRow,
  AdminSalesMetrics,
  AdminUrgentLeadRow,
} from "./admin.types";
import {
  getSmsFunnelAdminMetrics,
  listRecentSmsMessages,
} from "@/modules/sms-funnel/funnel.repository";
import { validateAdminLoginRequest } from "./admin.validators";

const STATUS_LABELS: Record<AssessmentStatus, string> = {
  started: "شروع شده",
  in_progress: "در حال انجام",
  completed: "تکمیل شده",
  abandoned: "رها شده",
};

function isAdminPasswordValid(password: string): boolean {
  return verifyConfiguredPassword(password, {
    plain: env.adminPassword,
    hash: env.adminPasswordHash,
  });
}

function formatAssessmentDate(date: Date): string {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toListItem(
  assessment: Awaited<ReturnType<typeof findAssessmentsForAdmin>>[number],
): AdminAssessmentListItem {
  return {
    assessmentId: assessment.id,
    businessName: assessment.organization.businessName,
    userName: assessment.user.name,
    phone: assessment.user.phone,
    status: assessment.status,
    statusLabel: STATUS_LABELS[assessment.status],
    startedAt: formatAssessmentDate(assessment.startedAt),
    completedAt: assessment.completedAt
      ? formatAssessmentDate(assessment.completedAt)
      : null,
    overallScore: assessment.overallScore
      ? {
          percentage: Math.round(assessment.overallScore.percentage),
          healthLevel: assessment.overallScore.healthLevel,
        }
      : null,
    detailUrl: `/admin/assessments/${assessment.id}`,
  };
}

export function requireAdminSession(
  session: AdminSession | null,
): asserts session is AdminSession {
  if (!session) {
    throw new AppError(
      "UNAUTHORIZED",
      "برای دسترسی به پنل ادمین ابتدا وارد شوید.",
      401,
    );
  }
}

export function verifyAdminPassword(body: unknown): void {
  const { password } = validateAdminLoginRequest(body);

  if (!env.adminPassword && !env.adminPasswordHash) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Admin login is not configured",
      500,
    );
  }

  if (!isAdminPasswordValid(password)) {
    throw new AppError("UNAUTHORIZED", "رمز عبور نادرست است.", 401);
  }
}

export async function listAssessments(
  filter: AdminAssessmentFilter,
): Promise<AdminAssessmentsResponse> {
  const [total, assessments] = await Promise.all([
    countAssessmentsForAdmin(filter),
    findAssessmentsForAdmin(filter),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / filter.pageSize);

  return {
    assessments: assessments.map(toListItem),
    pagination: {
      page: filter.page,
      pageSize: filter.pageSize,
      total,
      totalPages,
    },
  };
}

export function overallScoreLabel(item: AdminAssessmentListItem): string | null {
  if (!item.overallScore) {
    return null;
  }

  return `${item.overallScore.percentage}٪ — ${healthLevelLabelFa(item.overallScore.healthLevel)}`;
}

export async function getAssessmentForAdmin(
  assessmentId: string,
): Promise<AdminAssessmentDetail> {
  const assessment = await findAssessmentForAdmin(assessmentId);

  if (!assessment) {
    throw new AppError(
      "assessment_not_found",
      "Assessment not found",
      404,
      { assessmentId },
    );
  }

  const reportId = assessment.report?.id ?? null;

  return {
    assessmentId: assessment.id,
    status: assessment.status,
    statusLabel: STATUS_LABELS[assessment.status],
    businessName: assessment.organization.businessName,
    userName: assessment.user.name,
    phone: assessment.user.phone,
    email: assessment.user.email,
    startedAt: formatAssessmentDate(assessment.startedAt),
    completedAt: assessment.completedAt
      ? formatAssessmentDate(assessment.completedAt)
      : null,
    reportId,
    overallScore: assessment.overallScore
      ? {
          percentage: Math.round(assessment.overallScore.percentage),
          healthLevel: assessment.overallScore.healthLevel,
        }
      : null,
    expertViewUrl: `/expert/${assessment.id}`,
    resultUrl:
      assessment.status === "completed"
        ? `/assessment/${assessment.id}/result`
        : null,
    reportUrl:
      reportId && assessment.status === "completed"
        ? `/report/${reportId}?assessmentId=${assessment.id}`
        : null,
  };
}

function percent(part: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return Math.round((part / total) * 100);
}

const OPEN_LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "meeting_scheduled",
  "unreachable",
];

function buildLeadStatusFunnel(
  rows: Awaited<ReturnType<typeof countLeadsByStatus>>,
): AdminLeadStatusFunnel {
  const counts = new Map(rows.map((row) => [row.status, row._count.id]));

  return {
    new: counts.get("new") ?? 0,
    contacted: counts.get("contacted") ?? 0,
    meetingScheduled: counts.get("meeting_scheduled") ?? 0,
    closedWon: counts.get("closed_won") ?? 0,
    closedLost: counts.get("closed_lost") ?? 0,
    unreachable: counts.get("unreachable") ?? 0,
  };
}

function buildLeadSourceBreakdown(
  rows: Awaited<ReturnType<typeof groupLeadsBySource>>,
): AdminLeadSourceBreakdown {
  const counts = new Map(rows.map((row) => [row.source, row._count.id]));

  return {
    direct: counts.get("direct") ?? 0,
    system: counts.get("system") ?? 0,
    messenger: counts.get("messenger") ?? 0,
  };
}

const LEAD_SOURCE_LABELS: Record<
  AdminLeadSourceConversionRow["source"],
  string
> = {
  direct: "مستقیم",
  system: "سیستم",
  messenger: "پیام‌رسان",
};

function averageDaysBetween(
  samples: Array<{ createdAt: Date; targetAt: Date | null }>,
): number | null {
  const valid = samples.filter(
    (sample): sample is { createdAt: Date; targetAt: Date } =>
      sample.targetAt !== null,
  );

  if (valid.length === 0) {
    return null;
  }

  const totalMs = valid.reduce(
    (sum, sample) => sum + (sample.targetAt.getTime() - sample.createdAt.getTime()),
    0,
  );

  const avgDays = totalMs / valid.length / (24 * 60 * 60 * 1000);
  return Math.round(avgDays * 10) / 10;
}

function buildSourceConversion(
  rows: Awaited<ReturnType<typeof groupLeadsBySourceAndStatus>>,
): AdminLeadSourceConversionRow[] {
  const sources: AdminLeadSourceConversionRow["source"][] = [
    "direct",
    "system",
    "messenger",
  ];

  return sources.map((source) => {
    const sourceRows = rows.filter((row) => row.source === source);
    const total = sourceRows.reduce((sum, row) => sum + row._count.id, 0);
    const closedWon =
      sourceRows.find((row) => row.status === "closed_won")?._count.id ?? 0;

    return {
      source,
      sourceLabel: LEAD_SOURCE_LABELS[source],
      total,
      closedWon,
      conversionRate: percent(closedWon, total),
    };
  });
}

function buildSalesMetrics(
  sourceStatusRows: Awaited<ReturnType<typeof groupLeadsBySourceAndStatus>>,
  firstContactRows: Awaited<ReturnType<typeof findLeadsWithFirstContact>>,
  closeRows: Awaited<ReturnType<typeof findLeadsWithClose>>,
): AdminSalesMetrics {
  return {
    avgDaysToFirstContact: averageDaysBetween(
      firstContactRows.map((row) => ({
        createdAt: row.createdAt,
        targetAt: row.firstContactedAt,
      })),
    ),
    avgDaysToClose: averageDaysBetween(
      closeRows.map((row) => ({
        createdAt: row.createdAt,
        targetAt: row.closedAt,
      })),
    ),
    sourceConversion: buildSourceConversion(sourceStatusRows),
  };
}

function classifyUrgentLeadSeverity(
  lead: Awaited<ReturnType<typeof findUrgentLeads>>[number],
  now: Date,
): "amber" | "red" {
  if (
    lead.nextFollowUpAt &&
    lead.nextFollowUpAt < now &&
    OPEN_LEAD_STATUSES.includes(lead.status)
  ) {
    return "red";
  }

  return "amber";
}

function classifyUrgentLeadReason(
  lead: Awaited<ReturnType<typeof findUrgentLeads>>[number],
  staleThreshold: Date,
  now: Date,
): string {
  if (
    lead.nextFollowUpAt &&
    lead.nextFollowUpAt < now &&
    OPEN_LEAD_STATUSES.includes(lead.status)
  ) {
    return "پیگیری عقب‌افتاده";
  }

  if (!lead.assignedToId && lead.purchaseProbabilityBand === "high") {
    return "احتمال بالا — بدون تخصیص";
  }

  if (lead.status === "new" && lead.createdAt < staleThreshold) {
    return "لید جدید کهنه";
  }

  return "نیازمند توجه";
}

function mapUrgentLeads(
  leads: Awaited<ReturnType<typeof findUrgentLeads>>,
): AdminUrgentLeadRow[] {
  const now = new Date();
  const staleThreshold = new Date(
    now.getTime() - STALE_NEW_LEAD_HOURS * 60 * 60 * 1000,
  );

  return leads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    reason: classifyUrgentLeadReason(lead, staleThreshold, now),
    severity: classifyUrgentLeadSeverity(lead, now),
    detailUrl: `/expert/consultations/${lead.id}`,
  }));
}

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const weekStart = startOfWeek();
  const monthStart = startOfMonth();

  const [
    usersStartedThisWeek,
    usersCompletedThisWeek,
    usersVerifiedThisWeek,
    usersStartedAllTime,
    usersCompletedAllTime,
    usersWithConsultation,
    usersCriticalLeads,
    usersNewConsultations,
    assessmentsThisWeek,
    assessmentsThisMonth,
    leadGroups,
    salesExperts,
    leadStatusGroups,
    pendingAssignment,
    overdueFollowUps,
    staleNewLeads,
    highProbabilityUnassigned,
    newLeadsThisWeek,
    leadSourceGroups,
    leadSourceStatusGroups,
    firstContactRows,
    closeRows,
    overdueByAssignee,
    newThisWeekByAssignee,
    urgentLeadRows,
  ] = await Promise.all([
    countUsersStartedInRange(weekStart),
    countUsersCompletedInRange(weekStart),
    countUsersVerifiedSince(weekStart),
    countUsersStartedAllTime(),
    countUsersCompletedAllTime(),
    countUsersWithConsultation(),
    countUsersCriticalLeads(),
    countUsersWithNewConsultation(),
    countAssessmentsByDateRange(weekStart),
    countAssessmentsByDateRange(monthStart),
    groupLeadsByAssignee(),
    findActiveSalesExperts(),
    countLeadsByStatus(),
    countPendingAssignmentLeads(),
    countOverdueFollowUps(),
    countStaleNewLeads(STALE_NEW_LEAD_HOURS),
    countHighProbabilityUnassigned(),
    countLeadsCreatedInRange(weekStart),
    groupLeadsBySource(),
    groupLeadsBySourceAndStatus(),
    findLeadsWithFirstContact(),
    findLeadsWithClose(),
    countOverdueFollowUpsByAssignee(),
    countNewLeadsThisWeekByAssignee(weekStart),
    findUrgentLeads(10),
  ]);

  const leadStatusFunnel = buildLeadStatusFunnel(leadStatusGroups);
  const leadSourceBreakdown = buildLeadSourceBreakdown(leadSourceGroups);
  const salesMetrics = buildSalesMetrics(
    leadSourceStatusGroups,
    firstContactRows,
    closeRows,
  );
  const totalClosed =
    leadStatusFunnel.closedWon + leadStatusFunnel.closedLost;

  const overdueByAssigneeMap = new Map(
    overdueByAssignee.map((row) => [row.assignedToId!, row._count.id]),
  );
  const newThisWeekByAssigneeMap = new Map(
    newThisWeekByAssignee.map((row) => [row.assignedToId!, row._count.id]),
  );

  const expertStats = new Map<
    string,
    { assigned: number; closedWon: number; closedLost: number; open: number }
  >();

  for (const expert of salesExperts) {
    expertStats.set(expert.id, {
      assigned: 0,
      closedWon: 0,
      closedLost: 0,
      open: 0,
    });
  }

  for (const row of leadGroups) {
    if (!row.assignedToId) {
      continue;
    }

    const stats = expertStats.get(row.assignedToId) ?? {
      assigned: 0,
      closedWon: 0,
      closedLost: 0,
      open: 0,
    };

    stats.assigned += row._count.id;

    if (row.status === "closed_won") {
      stats.closedWon += row._count.id;
    } else if (row.status === "closed_lost") {
      stats.closedLost += row._count.id;
    } else {
      stats.open += row._count.id;
    }

    expertStats.set(row.assignedToId, stats);
  }

  const expertPerformance: AdminExpertPerformanceRow[] = salesExperts.map(
    (expert) => {
      const stats = expertStats.get(expert.id) ?? {
        assigned: 0,
        closedWon: 0,
        closedLost: 0,
        open: 0,
      };
      const closedTotal = stats.closedWon + stats.closedLost;

      return {
        staffUserId: expert.id,
        name: expert.name,
        ...stats,
        winRate: percent(stats.closedWon, closedTotal),
        overdueFollowUpOpen: overdueByAssigneeMap.get(expert.id) ?? 0,
        newThisWeek: newThisWeekByAssigneeMap.get(expert.id) ?? 0,
      };
    },
  );

  for (const [staffUserId, stats] of expertStats.entries()) {
    if (salesExperts.some((expert) => expert.id === staffUserId)) {
      continue;
    }

    const closedTotal = stats.closedWon + stats.closedLost;

    expertPerformance.push({
      staffUserId,
      name: "کارشناس (غیرفعال)",
      ...stats,
      winRate: percent(stats.closedWon, closedTotal),
      overdueFollowUpOpen: overdueByAssigneeMap.get(staffUserId) ?? 0,
      newThisWeek: newThisWeekByAssigneeMap.get(staffUserId) ?? 0,
    });
  }

  return {
    kpis: {
      usersStartedThisWeek,
      usersCompletedThisWeek,
      userCompletionRate: percent(usersCompletedAllTime, usersStartedAllTime),
      usersVerifiedThisWeek,
      usersCriticalLeads,
      usersNewConsultations,
      assessmentsThisWeek,
      assessmentsThisMonth,
    },
    funnel: {
      started: usersStartedAllTime,
      completed: usersCompletedAllTime,
      consultations: usersWithConsultation,
      completedRate: percent(usersCompletedAllTime, usersStartedAllTime),
      consultationRate: percent(
        usersWithConsultation,
        usersCompletedAllTime,
      ),
    },
    leadKpis: {
      newThisWeek: newLeadsThisWeek,
      pendingAssignment,
      overdueFollowUps,
      closeRate: percent(leadStatusFunnel.closedWon, totalClosed),
      highProbabilityUnassigned,
      staleNewLeads,
    },
    leadStatusFunnel,
    leadSourceBreakdown,
    salesMetrics,
    urgentLeads: mapUrgentLeads(urgentLeadRows),
    expertPerformance,
    smsFunnel: await getSmsFunnelAdminMetrics(),
    recentSmsMessages: (await listRecentSmsMessages(10)).map((row) => ({
      id: row.id,
      phone: row.phone,
      sequenceKey: row.sequenceKey,
      stepKey: row.stepKey,
      status: row.status,
      scheduledFor: row.scheduledFor.toISOString(),
      sentAt: row.sentAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
