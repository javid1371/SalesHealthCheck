import { db } from "@/lib/db";
import type { CreateConsultationRequestInput } from "@/modules/assessment/assessment.types";
import type { ConsultationListFilter } from "./consultation.types";
import type { LeadStatus, Prisma } from "@prisma/client";
import type { UpdateConsultationLeadInput } from "./consultation-lead.validators";

const OPEN_LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "meeting_scheduled",
  "unreachable",
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
): Prisma.ConsultationRequestUpdateInput {
  const data: Prisma.ConsultationRequestUpdateInput = {
    source,
    assignScheduledFor: null,
  };

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
  return db.consultationRequest.update({
    where: { id },
    data: buildConsultationUpgradeData("direct", input),
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
  return db.consultationRequest.update({
    where: { id },
    data: buildConsultationUpgradeData("messenger", input),
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
  }

  if (filter.source) {
    where.source = filter.source;
  }

  if (filter.purchaseProbabilityBand) {
    where.purchaseProbabilityBand = filter.purchaseProbabilityBand;
  }

  if (filter.onlyHot) {
    where.purchaseProbabilityBand = "high";
  }

  if (filter.onlyPendingAssignment) {
    where.source = "system";
    where.assignedToId = null;
    where.assignScheduledFor = { not: null };
  }

  if (filter.onlyUnassigned) {
    where.assignedToId = null;
  } else if (filter.assignedToId) {
    where.assignedToId = filter.assignedToId;
  }

  return where;
}

const consultationInclude = {
  assessmentSession: {
    include: {
      organization: true,
      user: true,
      overallScore: true,
    },
  },
  report: true,
  assignedTo: true,
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

export async function findConsultationRequests(filter: ConsultationListFilter) {
  return db.consultationRequest.findMany({
    where: buildConsultationWhere(filter),
    include: consultationInclude,
    orderBy: { createdAt: "desc" },
    skip: (filter.page - 1) * filter.pageSize,
    take: filter.pageSize,
  });
}

export async function findAllConsultationRequests(
  filter: Omit<ConsultationListFilter, "page" | "pageSize">,
) {
  return db.consultationRequest.findMany({
    where: buildConsultationWhere(filter),
    include: consultationInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function findConsultationRequestsByIds(ids: string[]) {
  if (ids.length === 0) {
    return [];
  }

  return db.consultationRequest.findMany({
    where: { id: { in: ids } },
    include: consultationInclude,
  });
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

  return db.consultationRequest.update({
    where: { id },
    data,
    include: consultationInclude,
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
    include: consultationInclude,
  });
}

export async function createLeadActivity(input: {
  consultationRequestId: string;
  staffUserId?: string | null;
  type: "created" | "status_change" | "assignment_change" | "note_added" | "probability_override" | "follow_up_set";
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
    include: consultationInclude,
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
