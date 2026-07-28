import { db } from "@/lib/db";
import type { CreateConsultationRequestInput } from "@/modules/assessment/assessment.types";
import type { ConsultationListFilter } from "./consultation.types";
import type {
  CallOutcome,
  LeadStatus,
  Prisma,
  StaffReminderType,
} from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { CAPACITY_COUNTED_LEAD_STATUSES } from "@/modules/staff/staff.repository";
import type { UpdateConsultationLeadInput } from "./consultation-lead.validators";
import { compareLeadsByCallQueuePriority } from "./lead-status";

export type ClaimLeadAtomicResult =
  | "ok"
  | "already_assigned"
  | "at_capacity"
  | "not_claimable";

const OPEN_LEAD_STATUSES: LeadStatus[] = [
  "assessment_in_progress",
  "assessment_incomplete",
  "assessment_completed",
  "new",
  "contacted",
  "meeting_scheduled",
  "unreachable",
];

/** Lead statuses that still belong to the assessment pipeline (pre-CRM). */
export const ASSESSMENT_PIPELINE_STATUSES: LeadStatus[] = [
  "assessment_in_progress",
  "assessment_incomplete",
  "assessment_completed",
];

const ASSESSMENT_OPEN_FOR_COMPLETE: LeadStatus[] = [
  "assessment_in_progress",
  "assessment_incomplete",
];

export async function createConsultationRequest(
  input: CreateConsultationRequestInput,
) {
  return db.consultationRequest.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      message: input.message,
      assessmentSessionId: input.assessmentSessionId,
      reportId: input.reportId,
      source: input.source,
      status: input.status,
      purchaseProbabilityPercent: input.purchaseProbabilityPercent,
      purchaseProbabilityBand: input.purchaseProbabilityBand,
      assignScheduledFor: input.assignScheduledFor,
    },
  });
}

export async function findConsultationRequestByAssessmentSessionId(
  assessmentSessionId: string,
) {
  return db.consultationRequest.findFirst({
    where: { assessmentSessionId },
    orderBy: { createdAt: "asc" },
  });
}

/** Any lead already linked to one of this user's assessment sessions. */
export async function findConsultationRequestByUserId(userId: string) {
  return db.consultationRequest.findFirst({
    where: {
      assessmentSession: { userId },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function findConsultationRequestsByUserId(userId: string) {
  return db.consultationRequest.findMany({
    where: {
      assessmentSession: { userId },
    },
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          leadActivities: true,
          consultationNotes: true,
        },
      },
    },
  });
}

export async function updateLeadAssessmentBinding(
  id: string,
  data: {
    assessmentSessionId: string;
    reportId?: string | null;
    status?: LeadStatus;
    name?: string;
    phone?: string | null;
    email?: string | null;
  },
) {
  return db.consultationRequest.update({
    where: { id },
    data: {
      assessmentSessionId: data.assessmentSessionId,
      ...(data.reportId !== undefined
        ? data.reportId
          ? { reportId: data.reportId }
          : { reportId: null }
        : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.name ? { name: data.name } : {}),
      ...(data.phone !== undefined
        ? { phone: data.phone ?? null }
        : {}),
      ...(data.email !== undefined
        ? { email: data.email ?? null }
        : {}),
    },
  });
}

export async function deleteConsultationRequestsByIds(ids: string[]) {
  if (ids.length === 0) {
    return { count: 0 };
  }
  return db.consultationRequest.deleteMany({
    where: { id: { in: ids } },
  });
}

export async function findDueSystemLeadsForAssignment(now: Date, limit = 100) {
  return db.consultationRequest.findMany({
    where: {
      source: "system",
      assignedToId: null,
      assignScheduledFor: { lte: now },
    },
    orderBy: { assignScheduledFor: "asc" },
    take: limit,
    select: { id: true },
  });
}

/** Open leads with no assignee — for automatic backfill / catch-up assignment. */
export async function findUnassignedOpenLeadsForAssignment(limit = 100) {
  return db.consultationRequest.findMany({
    where: {
      assignedToId: null,
      status: { in: OPEN_LEAD_STATUSES },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, status: true },
  });
}

export async function clearAssignScheduledFor(id: string) {
  return db.consultationRequest.update({
    where: { id },
    data: { assignScheduledFor: null },
  });
}

function buildConsultationUpgradeData(
  source: "direct" | "messenger",
  input: {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    reportId?: string;
  },
  currentStatus?: LeadStatus,
): Prisma.ConsultationRequestUpdateInput {
  const data: Prisma.ConsultationRequestUpdateInput = {
    source,
    assignScheduledFor: null,
  };

  if (
    currentStatus &&
    ASSESSMENT_PIPELINE_STATUSES.includes(currentStatus)
  ) {
    data.status = "new";
  }

  if (input.name) {
    data.name = input.name;
  }
  if (input.email) {
    data.email = input.email;
  }
  if (input.phone) {
    data.phone = input.phone;
  }
  if (input.message) {
    data.message = input.message;
  }
  if (input.reportId) {
    data.report = { connect: { id: input.reportId } };
  }

  return data;
}

export async function upgradeConsultationRequestToDirect(
  id: string,
  input: {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    reportId?: string;
  },
) {
  const existing = await db.consultationRequest.findUnique({
    where: { id },
    select: { status: true },
  });

  return db.consultationRequest.update({
    where: { id },
    data: buildConsultationUpgradeData("direct", input, existing?.status),
  });
}

export async function upgradeConsultationRequestToMessenger(
  id: string,
  input: {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    reportId?: string;
  },
) {
  const existing = await db.consultationRequest.findUnique({
    where: { id },
    select: { status: true },
  });

  return db.consultationRequest.update({
    where: { id },
    data: buildConsultationUpgradeData("messenger", input, existing?.status),
  });
}

/**
 * Conditionally update lead status when current status is in `fromStatuses`.
 * Returns true when a row was updated.
 */
export async function transitionLeadStatusIfCurrent(
  id: string,
  fromStatuses: LeadStatus[],
  toStatus: LeadStatus,
  extra?: {
    reportId?: string;
  },
): Promise<{ transitioned: boolean; fromStatus: LeadStatus | null }> {
  const existing = await db.consultationRequest.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!existing || !fromStatuses.includes(existing.status)) {
    return { transitioned: false, fromStatus: existing?.status ?? null };
  }

  const result = await db.consultationRequest.updateMany({
    where: { id, status: { in: fromStatuses } },
    data: {
      status: toStatus,
      ...(extra?.reportId ? { reportId: extra.reportId } : {}),
    },
  });

  return {
    transitioned: result.count > 0,
    fromStatus: existing.status,
  };
}

export async function transitionLeadToAssessmentCompleted(
  id: string,
  reportId: string,
): Promise<{ transitioned: boolean; fromStatus: LeadStatus | null }> {
  return transitionLeadStatusIfCurrent(
    id,
    ASSESSMENT_OPEN_FOR_COMPLETE,
    "assessment_completed",
    { reportId },
  );
}

export async function transitionLeadToAssessmentIncomplete(
  id: string,
): Promise<{ transitioned: boolean; fromStatus: LeadStatus | null }> {
  return transitionLeadStatusIfCurrent(
    id,
    ["assessment_in_progress"],
    "assessment_incomplete",
  );
}

export async function findAssessmentInProgressLeadsForStaleCheck(limit = 200) {
  return db.consultationRequest.findMany({
    where: {
      status: "assessment_in_progress",
      assessmentSessionId: { not: null },
      assessmentSession: {
        status: { in: ["started", "in_progress", "abandoned"] },
      },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: {
      id: true,
      status: true,
      updatedAt: true,
      assessmentSession: {
        select: {
          id: true,
          status: true,
          updatedAt: true,
          startedAt: true,
          answers: {
            select: { answeredAt: true },
            orderBy: { answeredAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });
}

export async function attachReportToLeadIfMissing(
  id: string,
  reportId: string,
): Promise<void> {
  await db.consultationRequest.updateMany({
    where: { id, reportId: null },
    data: { reportId },
  });
}

export async function updateLeadPurchaseProbability(
  id: string,
  input: {
    purchaseProbabilityPercent: number;
    purchaseProbabilityBand: Prisma.ConsultationRequestUpdateInput["purchaseProbabilityBand"];
  },
) {
  return db.consultationRequest.update({
    where: { id },
    data: {
      purchaseProbabilityPercent: input.purchaseProbabilityPercent,
      purchaseProbabilityBand: input.purchaseProbabilityBand,
    },
  });
}

export async function assignLeadToExpertIfUnassigned(
  leadId: string,
  expertId: string,
): Promise<boolean> {
  const result = await db.consultationRequest.updateMany({
    where: { id: leadId, assignedToId: null },
    data: { assignedToId: expertId },
  });

  return result.count > 0;
}

/**
 * Atomically claim an unassigned open lead if the expert is under capacity.
 * Capacity count + assign run in one transaction to reduce race over-claim.
 */
export async function claimLeadIfUnassignedUnderCapacity(
  leadId: string,
  expertId: string,
  maxOpenLeadsPerExpert: number,
): Promise<ClaimLeadAtomicResult> {
  return db.$transaction(async (tx) => {
    const lead = await tx.consultationRequest.findUnique({
      where: { id: leadId },
      select: { id: true, assignedToId: true, status: true },
    });

    if (!lead) {
      return "not_claimable";
    }

    if (lead.assignedToId !== null) {
      return "already_assigned";
    }

    if (lead.status === "closed_won" || lead.status === "closed_lost") {
      return "not_claimable";
    }

    const openCount = await tx.consultationRequest.count({
      where: {
        assignedToId: expertId,
        status: { in: CAPACITY_COUNTED_LEAD_STATUSES },
      },
    });

    if (openCount >= maxOpenLeadsPerExpert) {
      return "at_capacity";
    }

    const result = await tx.consultationRequest.updateMany({
      where: { id: leadId, assignedToId: null },
      data: { assignedToId: expertId },
    });

    if (result.count === 0) {
      return "already_assigned";
    }

    await tx.staffUser.update({
      where: { id: expertId },
      data: { lastAssignedAt: new Date() },
    });

    return "ok";
  });
}

function buildConsultationWhere(
  filter: Omit<ConsultationListFilter, "page" | "pageSize">,
): Prisma.ConsultationRequestWhereInput {
  const where: Prisma.ConsultationRequestWhereInput = {};
  const assessmentSession: Prisma.AssessmentSessionWhereInput = {};

  if (filter.phone) {
    where.OR = [
      { phone: { contains: filter.phone } },
      {
        assessmentSession: {
          user: { phone: { contains: filter.phone } },
        },
      },
    ];
  }

  if (filter.businessName) {
    assessmentSession.organization = {
      businessName: { contains: filter.businessName, mode: "insensitive" },
    };
  }

  if (Object.keys(assessmentSession).length > 0) {
    where.assessmentSession = assessmentSession;
  }

  if (filter.createdFrom || filter.createdTo) {
    where.createdAt = {
      ...(filter.createdFrom ? { gte: filter.createdFrom } : {}),
      ...(filter.createdTo ? { lte: filter.createdTo } : {}),
    };
  }

  if (filter.status) {
    where.status = filter.status;
  } else if (filter.excludeAssessmentInProgress) {
    where.status = { not: "assessment_in_progress" };
  }

  if (filter.source) {
    where.source = filter.source;
  }

  if (filter.purchaseProbabilityBand) {
    where.purchaseProbabilityBand = filter.purchaseProbabilityBand;
  }

  if (filter.onlyNeverCalled) {
    where.lastCallOutcome = null;
  } else if (filter.lastCallOutcome) {
    where.lastCallOutcome = filter.lastCallOutcome;
  }

  if (filter.onlyHot) {
    where.purchaseProbabilityBand = "high";
  }

  if (filter.onlyPendingAssignment) {
    where.source = "system";
    where.assignedToId = null;
    where.assignScheduledFor = { not: null };
  }

  if (filter.onlyOverdueFollowUp) {
    where.nextFollowUpAt = { lt: new Date() };
    if (!filter.status) {
      const openStatuses = filter.excludeAssessmentInProgress
        ? OPEN_LEAD_STATUSES.filter(
            (status) => status !== "assessment_in_progress",
          )
        : OPEN_LEAD_STATUSES;
      where.status = { in: openStatuses };
    }
  } else if (filter.onlyFollowUpDueToday) {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    where.nextFollowUpAt = { lte: endOfToday };
    if (!filter.status) {
      const openStatuses = filter.excludeAssessmentInProgress
        ? OPEN_LEAD_STATUSES.filter(
            (status) => status !== "assessment_in_progress",
          )
        : OPEN_LEAD_STATUSES;
      where.status = { in: openStatuses };
    }
  }

  if (filter.onlyTeamQueue || filter.onlyUnassigned) {
    where.assignedToId = null;
  } else if (filter.assignedToId) {
    where.assignedToId = filter.assignedToId;
  }

  if (filter.onlyTeamQueue && !filter.status && where.status === undefined) {
    const openStatuses = filter.excludeAssessmentInProgress
      ? OPEN_LEAD_STATUSES.filter(
          (status) => status !== "assessment_in_progress",
        )
      : OPEN_LEAD_STATUSES;
    where.status = { in: openStatuses };
  }

  return where;
}

/** Lean relations for list/kanban — avoid loading heavy report JSON blobs. */
const consultationListInclude = {
  assessmentSession: {
    select: {
      id: true,
      resultToken: true,
      organization: {
        select: { businessName: true },
      },
      user: {
        select: { phone: true },
      },
      overallScore: {
        select: { percentage: true },
      },
    },
  },
  assignedTo: {
    select: { id: true, name: true },
  },
} as const;

const consultationDetailInclude = {
  assessmentSession: {
    include: {
      organization: true,
      user: true,
      overallScore: true,
      bottlenecks: {
        include: { domain: true },
        orderBy: { rank: "asc" as const },
        take: 5,
      },
      diagnoses: {
        orderBy: { priority: "desc" as const },
        take: 5,
      },
    },
  },
  report: true,
  assignedTo: true,
  consultationNotes: {
    include: { staffUser: true },
    orderBy: { createdAt: "desc" as const },
  },
  leadActivities: {
    include: { staffUser: true },
    orderBy: { createdAt: "desc" as const },
  },
} as const;

export async function countConsultationRequests(filter: ConsultationListFilter) {
  return db.consultationRequest.count({
    where: buildConsultationWhere(filter),
  });
}

async function hydrateConsultationListRows(ids: string[]) {
  if (ids.length === 0) {
    return [];
  }

  const rows = await db.consultationRequest.findMany({
    where: { id: { in: ids } },
    include: consultationListInclude,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export async function findConsultationRequests(filter: ConsultationListFilter) {
  // Rank with a light query first — never join report/org for every lead just to paginate.
  const rankingRows = await db.consultationRequest.findMany({
    where: buildConsultationWhere(filter),
    select: { id: true, status: true, createdAt: true },
  });
  rankingRows.sort(compareLeadsByCallQueuePriority);

  const start = (filter.page - 1) * filter.pageSize;
  const pageIds = rankingRows
    .slice(start, start + filter.pageSize)
    .map((row) => row.id);

  return hydrateConsultationListRows(pageIds);
}

/** Full board payload for Kanban (lean joins, no artificial page cap). */
export async function findConsultationRequestsForKanban(
  filter: Omit<ConsultationListFilter, "page" | "pageSize">,
) {
  const rows = await db.consultationRequest.findMany({
    where: buildConsultationWhere(filter),
    include: consultationListInclude,
  });
  rows.sort(compareLeadsByCallQueuePriority);
  return rows;
}

export async function findAllConsultationRequests(
  filter: Omit<ConsultationListFilter, "page" | "pageSize">,
) {
  return findConsultationRequestsForKanban(filter);
}

export async function findConsultationRequestsByIds(ids: string[]) {
  return hydrateConsultationListRows(ids);
}

export async function findConsultationRequestById(id: string) {
  return db.consultationRequest.findUnique({
    where: { id },
    include: consultationDetailInclude,
  });
}

export async function updateConsultationLead(
  id: string,
  input: UpdateConsultationLeadInput & {
    firstContactedAt?: Date;
    closedAt?: Date;
    lastCallOutcome?: CallOutcome | null;
    lastCalledAt?: Date | null;
    lostReason?: UpdateConsultationLeadInput["lostReason"];
    lostNote?: string | null;
  },
) {
  const data: Prisma.ConsultationRequestUpdateInput = {};

  if (input.status !== undefined) {
    data.status = input.status;
  }

  if (input.assignedToId !== undefined) {
    data.assignedTo =
      input.assignedToId === null
        ? { disconnect: true }
        : { connect: { id: input.assignedToId } };
  }

  if (input.nextFollowUpAt !== undefined) {
    data.nextFollowUpAt = input.nextFollowUpAt;
  }

  if (input.adminProbabilityOverridePercent !== undefined) {
    data.adminProbabilityOverridePercent = input.adminProbabilityOverridePercent;
  }

  if (input.firstContactedAt !== undefined) {
    data.firstContactedAt = input.firstContactedAt;
  }

  if (input.closedAt !== undefined) {
    data.closedAt = input.closedAt;
  }

  if (input.lastCallOutcome !== undefined) {
    data.lastCallOutcome = input.lastCallOutcome;
  }

  if (input.lastCalledAt !== undefined) {
    data.lastCalledAt = input.lastCalledAt;
  }

  if (input.lostReason !== undefined) {
    data.lostReason = input.lostReason;
  }

  if (input.lostNote !== undefined) {
    data.lostNote = input.lostNote;
  }

  return db.consultationRequest.update({
    where: { id },
    data,
    include: consultationListInclude,
  });
}

export async function createManualConsultationRequest(input: {
  name: string;
  email?: string;
  phone?: string;
  message?: string;
}) {
  return db.consultationRequest.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      message: input.message,
      source: "direct",
    },
    include: consultationListInclude,
  });
}

export async function createLeadActivity(input: {
  consultationRequestId: string;
  staffUserId?: string | null;
  type:
    | "created"
    | "status_change"
    | "assignment_change"
    | "note_added"
    | "probability_override"
    | "follow_up_set"
    | "call_logged";
  detail?: string | null;
}) {
  return db.leadActivity.create({
    data: {
      consultationRequestId: input.consultationRequestId,
      staffUserId: input.staffUserId ?? null,
      type: input.type,
      detail: input.detail ?? null,
    },
  });
}

export async function createLeadCallLog(input: {
  consultationRequestId: string;
  staffUserId: string;
  outcome: CallOutcome;
  note?: string | null;
}) {
  return db.leadCallLog.create({
    data: {
      consultationRequestId: input.consultationRequestId,
      staffUserId: input.staffUserId,
      outcome: input.outcome,
      note: input.note ?? null,
    },
  });
}

export async function bulkUpdateConsultationLeads(
  ids: string[],
  input: Pick<
    UpdateConsultationLeadInput,
    "status" | "assignedToId"
  >,
) {
  const data: Prisma.ConsultationRequestUpdateInput = {};

  if (input.status !== undefined) {
    data.status = input.status;
  }

  if (input.assignedToId !== undefined) {
    data.assignedTo =
      input.assignedToId === null
        ? { disconnect: true }
        : { connect: { id: input.assignedToId } };
  }

  if (Object.keys(data).length === 0) {
    return { count: 0 };
  }

  return db.consultationRequest.updateMany({
    where: { id: { in: ids } },
    data,
  });
}

export async function addConsultationNote(input: {
  consultationRequestId: string;
  staffUserId: string;
  body: string;
}) {
  return db.consultationNote.create({
    data: {
      consultationRequestId: input.consultationRequestId,
      staffUserId: input.staffUserId,
      body: input.body,
    },
    include: { staffUser: true },
  });
}

export async function findConsultationNotes(consultationRequestId: string) {
  return db.consultationNote.findMany({
    where: { consultationRequestId },
    include: { staffUser: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function countLeadsNeedingFollowUp(
  assignedToId: string,
  byDate: Date,
) {
  return db.consultationRequest.count({
    where: {
      assignedToId,
      nextFollowUpAt: { lte: byDate },
      status: { in: OPEN_LEAD_STATUSES },
    },
  });
}

export async function findLeadsNeedingFollowUp(
  assignedToId: string,
  byDate: Date,
  limit = 10,
) {
  return db.consultationRequest.findMany({
    where: {
      assignedToId,
      nextFollowUpAt: { lte: byDate },
      status: { in: OPEN_LEAD_STATUSES },
    },
    include: consultationListInclude,
    orderBy: { nextFollowUpAt: "asc" },
    take: limit,
  });
}

export async function countClosedLeadsSince(
  assignedToId: string,
  since: Date,
) {
  return db.consultationRequest.count({
    where: {
      assignedToId,
      status: { in: ["closed_won", "closed_lost"] },
      updatedAt: { gte: since },
    },
  });
}

/** Due/overdue follow-up counts for open leads, grouped by assignee. */
export async function countFollowUpsDueByAssignee(byDate: Date) {
  const rows = await db.consultationRequest.groupBy({
    by: ["assignedToId"],
    _count: { id: true },
    where: {
      assignedToId: { not: null },
      nextFollowUpAt: { lte: byDate },
      status: { in: OPEN_LEAD_STATUSES },
    },
  });

  return rows
    .filter((row) => row.assignedToId != null)
    .map((row) => ({
      assignedToId: row.assignedToId as string,
      count: row._count.id,
    }));
}

export async function countOverdueFollowUpsByAssignee(asOf: Date) {
  const rows = await db.consultationRequest.groupBy({
    by: ["assignedToId"],
    _count: { id: true },
    where: {
      assignedToId: { not: null },
      nextFollowUpAt: { lt: asOf },
      status: { in: OPEN_LEAD_STATUSES },
    },
  });

  return rows
    .filter((row) => row.assignedToId != null)
    .map((row) => ({
      assignedToId: row.assignedToId as string,
      count: row._count.id,
    }));
}

/**
 * Atomically claims a daily reminder slot. Returns true if claimed,
 * false if the unique (staff, date, type) row already exists.
 */
export async function tryCreateStaffReminderLog(input: {
  staffUserId: string;
  date: Date;
  type: StaffReminderType;
}): Promise<boolean> {
  try {
    await db.staffReminderLog.create({
      data: {
        staffUserId: input.staffUserId,
        date: input.date,
        type: input.type,
      },
    });
    return true;
  } catch (error) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return false;
    }
    throw error;
  }
}

export async function deleteStaffReminderLog(input: {
  staffUserId: string;
  date: Date;
  type: StaffReminderType;
}): Promise<void> {
  await db.staffReminderLog.deleteMany({
    where: {
      staffUserId: input.staffUserId,
      date: input.date,
      type: input.type,
    },
  });
}
