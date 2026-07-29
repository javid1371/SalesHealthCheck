import type { AssessmentStatus, LeadSource, LeadStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { STALE_NEW_LEAD_HOURS } from "@/modules/consultation/lead-sla";
import type { AdminAssessmentFilter } from "./admin.types";

/** User-initiated consultation sources (excludes auto-created system leads). */
const USER_CONSULTATION_SOURCES: LeadSource[] = ["direct", "messenger"];

export { STALE_NEW_LEAD_HOURS };

const OPEN_LEAD_STATUSES: LeadStatus[] = [
  "assessment_in_progress",
  "assessment_incomplete",
  "assessment_completed",
  "new",
  "contacted",
  "meeting_scheduled",
  "unreachable",
];

function startOfDay(date = new Date()): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(date = new Date()): Date {
  const result = startOfDay(date);
  result.setDate(result.getDate() - 6);
  return result;
}

function startOfMonth(date = new Date()): Date {
  const result = startOfDay(date);
  result.setDate(1);
  return result;
}

function buildAssessmentWhere(
  filter: AdminAssessmentFilter,
): Prisma.AssessmentSessionWhereInput {
  const where: Prisma.AssessmentSessionWhereInput = {};

  if (filter.status) {
    where.status = filter.status;
  }

  if (filter.startedFrom || filter.startedTo) {
    where.startedAt = {
      ...(filter.startedFrom ? { gte: filter.startedFrom } : {}),
      ...(filter.startedTo ? { lte: filter.startedTo } : {}),
    };
  }

  if (filter.businessName) {
    where.organization = {
      businessName: {
        contains: filter.businessName,
        mode: "insensitive",
      },
    };
  }

  if (filter.phone) {
    where.user = {
      phone: {
        contains: filter.phone,
      },
    };
  }

  return where;
}

export async function countAssessmentsForAdmin(filter: AdminAssessmentFilter) {
  return db.assessmentSession.count({
    where: buildAssessmentWhere(filter),
  });
}

export async function findAssessmentsForAdmin(filter: AdminAssessmentFilter) {
  const skip = (filter.page - 1) * filter.pageSize;

  return db.assessmentSession.findMany({
    where: buildAssessmentWhere(filter),
    orderBy: { startedAt: "desc" },
    skip,
    take: filter.pageSize,
    include: {
      user: true,
      organization: true,
      overallScore: true,
      report: {
        select: { id: true },
      },
    },
  });
}

export async function findAssessmentForAdmin(assessmentId: string) {
  return db.assessmentSession.findUnique({
    where: { id: assessmentId },
    include: {
      user: true,
      organization: true,
      overallScore: true,
      report: {
        select: { id: true },
      },
    },
  });
}

export async function countAssessmentsByDateRange(
  from: Date,
  to?: Date,
): Promise<number> {
  return db.assessmentSession.count({
    where: {
      startedAt: {
        gte: from,
        ...(to ? { lte: to } : {}),
      },
    },
  });
}

export async function countAssessmentsByStatus(
  status: AssessmentStatus,
): Promise<number> {
  return db.assessmentSession.count({ where: { status } });
}

export async function countAllAssessments(): Promise<number> {
  return db.assessmentSession.count();
}

export async function countAllConsultationRequests(): Promise<number> {
  return db.consultationRequest.count();
}

export async function countConsultationsByStatus(
  status: LeadStatus,
): Promise<number> {
  return db.consultationRequest.count({ where: { status } });
}

export async function countCriticalCompletedConsultations(): Promise<number> {
  return db.consultationRequest.count({
    where: {
      assessmentSession: {
        status: "completed",
        overallScore: {
          healthLevel: { in: ["critical", "weak"] },
        },
      },
    },
  });
}

export async function countUsersVerifiedSince(
  from: Date,
  to?: Date,
): Promise<number> {
  return db.user.count({
    where: {
      phoneVerifiedAt: {
        gte: from,
        ...(to ? { lte: to } : {}),
      },
    },
  });
}

export async function countUsersStartedInRange(
  from: Date,
  to?: Date,
): Promise<number> {
  return db.user.count({
    where: {
      assessmentSessions: {
        some: {
          startedAt: {
            gte: from,
            ...(to ? { lte: to } : {}),
          },
        },
      },
    },
  });
}

export async function countUsersCompletedInRange(
  from: Date,
  to?: Date,
): Promise<number> {
  return db.user.count({
    where: {
      assessmentSessions: {
        some: {
          status: "completed",
          completedAt: {
            gte: from,
            ...(to ? { lte: to } : {}),
          },
        },
      },
    },
  });
}

/**
 * Completers with ≥1 real user consultation request (direct/messenger).
 * System-only leads and FunnelEvent consultation_submitted are excluded.
 */
export async function countUsersWithConsultation(): Promise<number> {
  return db.user.count({
    where: {
      assessmentSessions: {
        some: {
          status: "completed",
          consultationRequests: {
            some: {
              source: { in: USER_CONSULTATION_SOURCES },
            },
          },
        },
      },
    },
  });
}

/** Same definition as countUsersWithConsultation — shared KPI numerator. */
export async function countUsersWithNewConsultation(): Promise<number> {
  return countUsersWithConsultation();
}

export async function countUsersCriticalLeads(): Promise<number> {
  return db.user.count({
    where: {
      assessmentSessions: {
        some: {
          status: "completed",
          overallScore: {
            healthLevel: { in: ["critical", "weak"] },
          },
          consultationRequests: { some: {} },
        },
      },
    },
  });
}

export async function countUsersStartedAllTime(): Promise<number> {
  return db.user.count({
    where: {
      assessmentSessions: { some: {} },
    },
  });
}

export async function countUsersCompletedAllTime(): Promise<number> {
  return db.user.count({
    where: {
      assessmentSessions: {
        some: { status: "completed" },
      },
    },
  });
}

export async function groupLeadsByAssignee() {
  return db.consultationRequest.groupBy({
    by: ["assignedToId", "status"],
    _count: { id: true },
    where: { assignedToId: { not: null } },
  });
}

export async function countLeadsByStatus() {
  return db.consultationRequest.groupBy({
    by: ["status"],
    _count: { id: true },
  });
}

export async function countPendingAssignmentLeads() {
  return db.consultationRequest.count({
    where: {
      source: "system",
      assignedToId: null,
      assignScheduledFor: { not: null },
    },
  });
}

export async function countOverdueFollowUps() {
  return db.consultationRequest.count({
    where: {
      nextFollowUpAt: { lt: new Date() },
      status: { in: OPEN_LEAD_STATUSES },
    },
  });
}

export async function countStaleNewLeads(hours: number) {
  const threshold = new Date(Date.now() - hours * 60 * 60 * 1000);
  return db.consultationRequest.count({
    where: {
      status: "new",
      createdAt: { lt: threshold },
    },
  });
}

export async function countHighProbabilityUnassigned() {
  return db.consultationRequest.count({
    where: {
      assignedToId: null,
      purchaseProbabilityBand: "high",
    },
  });
}

export async function countUnassignedOpenLeads() {
  return db.consultationRequest.count({
    where: {
      assignedToId: null,
      status: { in: OPEN_LEAD_STATUSES },
    },
  });
}

const OPS_QUEUE_LEAD_SELECT = {
  id: true,
  name: true,
  phone: true,
  status: true,
  source: true,
  purchaseProbabilityBand: true,
  nextFollowUpAt: true,
  createdAt: true,
  firstContactedAt: true,
  assignScheduledFor: true,
  assignedToId: true,
  assignedTo: { select: { id: true, name: true } },
} as const;

const DEFAULT_OPS_QUEUE_LIMIT = 15;

export async function findPendingAssignmentLeads(
  limit = DEFAULT_OPS_QUEUE_LIMIT,
) {
  return db.consultationRequest.findMany({
    where: {
      source: "system",
      assignedToId: null,
      assignScheduledFor: { not: null },
    },
    select: OPS_QUEUE_LEAD_SELECT,
    orderBy: [{ assignScheduledFor: "asc" }, { createdAt: "asc" }],
    take: limit,
  });
}

export async function findUnassignedOpenLeads(limit = DEFAULT_OPS_QUEUE_LIMIT) {
  return db.consultationRequest.findMany({
    where: {
      assignedToId: null,
      status: { in: OPEN_LEAD_STATUSES },
    },
    select: OPS_QUEUE_LEAD_SELECT,
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function findOverdueFollowUpLeads(limit = DEFAULT_OPS_QUEUE_LIMIT) {
  return db.consultationRequest.findMany({
    where: {
      nextFollowUpAt: { lt: new Date() },
      status: { in: OPEN_LEAD_STATUSES },
    },
    select: OPS_QUEUE_LEAD_SELECT,
    orderBy: { nextFollowUpAt: "asc" },
    take: limit,
  });
}

export async function findStaleNewLeadsForOps(
  hours: number,
  limit = DEFAULT_OPS_QUEUE_LIMIT,
) {
  const threshold = new Date(Date.now() - hours * 60 * 60 * 1000);
  return db.consultationRequest.findMany({
    where: {
      status: "new",
      createdAt: { lt: threshold },
    },
    select: OPS_QUEUE_LEAD_SELECT,
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function findHighProbabilityUnassignedLeads(
  limit = DEFAULT_OPS_QUEUE_LIMIT,
) {
  return db.consultationRequest.findMany({
    where: {
      assignedToId: null,
      purchaseProbabilityBand: "high",
    },
    select: OPS_QUEUE_LEAD_SELECT,
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function findFirstContactSlaBreachedLeads(
  minutesByBand: { high: number; mid: number; low: number },
  limit = DEFAULT_OPS_QUEUE_LIMIT,
) {
  const now = Date.now();
  const highThreshold = new Date(now - minutesByBand.high * 60 * 1000);
  const midThreshold = new Date(now - minutesByBand.mid * 60 * 1000);
  const lowThreshold = new Date(now - minutesByBand.low * 60 * 1000);

  return db.consultationRequest.findMany({
    where: {
      firstContactedAt: null,
      status: { in: OPEN_LEAD_STATUSES },
      OR: [
        {
          purchaseProbabilityBand: "high",
          createdAt: { lt: highThreshold },
        },
        {
          purchaseProbabilityBand: "medium",
          createdAt: { lt: midThreshold },
        },
        {
          purchaseProbabilityBand: "low",
          createdAt: { lt: lowThreshold },
        },
        {
          purchaseProbabilityBand: null,
          createdAt: { lt: midThreshold },
        },
      ],
    },
    select: OPS_QUEUE_LEAD_SELECT,
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function countFirstContactSlaBreachedLeads(
  minutesByBand: { high: number; mid: number; low: number },
) {
  const now = Date.now();
  const highThreshold = new Date(now - minutesByBand.high * 60 * 1000);
  const midThreshold = new Date(now - minutesByBand.mid * 60 * 1000);
  const lowThreshold = new Date(now - minutesByBand.low * 60 * 1000);

  return db.consultationRequest.count({
    where: {
      firstContactedAt: null,
      status: { in: OPEN_LEAD_STATUSES },
      OR: [
        {
          purchaseProbabilityBand: "high",
          createdAt: { lt: highThreshold },
        },
        {
          purchaseProbabilityBand: "medium",
          createdAt: { lt: midThreshold },
        },
        {
          purchaseProbabilityBand: "low",
          createdAt: { lt: lowThreshold },
        },
        {
          purchaseProbabilityBand: null,
          createdAt: { lt: midThreshold },
        },
      ],
    },
  });
}

export async function countCallsByStaffSince(from: Date) {
  return db.leadCallLog.groupBy({
    by: ["staffUserId"],
    _count: { id: true },
    where: { createdAt: { gte: from } },
  });
}

export async function countStalePendingSmsMessages(olderThanMinutes: number) {
  const threshold = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  return db.smsMessage.count({
    where: {
      status: "pending",
      scheduledFor: { lt: threshold },
    },
  });
}

export async function countLeadsCreatedInRange(from: Date, to?: Date) {
  return db.consultationRequest.count({
    where: {
      createdAt: {
        gte: from,
        ...(to ? { lte: to } : {}),
      },
    },
  });
}

export async function groupLeadsBySource() {
  return db.consultationRequest.groupBy({
    by: ["source"],
    _count: { id: true },
  });
}

export async function groupLeadsBySourceAndStatus() {
  return db.consultationRequest.groupBy({
    by: ["source", "status"],
    _count: { id: true },
  });
}

export async function findLeadsWithFirstContact() {
  return db.consultationRequest.findMany({
    where: { firstContactedAt: { not: null } },
    select: { createdAt: true, firstContactedAt: true },
  });
}

export async function findLeadsWithClose() {
  return db.consultationRequest.findMany({
    where: { closedAt: { not: null } },
    select: { createdAt: true, closedAt: true },
  });
}

export async function countOverdueFollowUpsByAssignee() {
  return db.consultationRequest.groupBy({
    by: ["assignedToId"],
    _count: { id: true },
    where: {
      assignedToId: { not: null },
      nextFollowUpAt: { lt: new Date() },
      status: { in: OPEN_LEAD_STATUSES },
    },
  });
}

export async function countNewLeadsThisWeekByAssignee(from: Date) {
  return db.consultationRequest.groupBy({
    by: ["assignedToId"],
    _count: { id: true },
    where: {
      assignedToId: { not: null },
      status: "new",
      createdAt: { gte: from },
    },
  });
}

export async function findUrgentLeads(
  limit = 10,
  staleNewLeadHours: number = STALE_NEW_LEAD_HOURS,
) {
  const hours =
    Number.isFinite(staleNewLeadHours) && staleNewLeadHours > 0
      ? staleNewLeadHours
      : STALE_NEW_LEAD_HOURS;
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - hours * 60 * 60 * 1000);

  return db.consultationRequest.findMany({
    where: {
      OR: [
        { assignedToId: null, purchaseProbabilityBand: "high" },
        { status: "new", createdAt: { lt: staleThreshold } },
        {
          nextFollowUpAt: { lt: now },
          status: { in: OPEN_LEAD_STATUSES },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      status: true,
      purchaseProbabilityBand: true,
      nextFollowUpAt: true,
      createdAt: true,
      assignedToId: true,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function findActiveSalesExperts() {
  return db.staffUser.findMany({
    where: { role: "sales_expert", isActive: true },
    select: {
      id: true,
      name: true,
      assignmentPausedAt: true,
      assignmentPausedReason: true,
      maxDailyCalls: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function groupCallLogsByStaffAndOutcomeSince(from: Date) {
  return db.leadCallLog.groupBy({
    by: ["staffUserId", "outcome"],
    _count: { id: true },
    where: {
      createdAt: { gte: from },
    },
  });
}

export async function groupClosedLostByReasonSince(from: Date) {
  return db.consultationRequest.groupBy({
    by: ["lostReason"],
    _count: { id: true },
    where: {
      status: "closed_lost",
      closedAt: { gte: from },
    },
  });
}

export { startOfDay, startOfWeek, startOfMonth };
