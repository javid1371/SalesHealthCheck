import type { AssessmentStatus, LeadStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  ASSESSMENT_PIPELINE_STATUSES,
  createConsultationRequest,
  deleteConsultationRequestsByIds,
  findConsultationRequestsByUserId,
  updateLeadAssessmentBinding,
} from "./consultation.repository";
import { finalizeNewLead } from "./lead-assignment.service";
import { getLeadSettings } from "./lead-config.service";

export type LeadBackfillGroup =
  | "all"
  | "active"
  | "completed"
  | "abandoned";

export interface LeadBackfillResult {
  dryRun: boolean;
  group: LeadBackfillGroup;
  eligible: number;
  created: number;
  assigned: number;
  updated: number;
  deleted: number;
  skipped: number;
  failed: number;
}

type LatestAssessment = {
  id: string;
  userId: string;
  status: AssessmentStatus;
  updatedAt: Date;
  startedAt: Date;
  createdAt: Date;
  user: {
    name: string | null;
    phone: string | null;
    email: string | null;
  };
  organization: {
    businessName: string;
  };
  report: { id: string } | null;
  answers: { answeredAt: Date }[];
};

function lastActivityAt(row: {
  updatedAt: Date;
  startedAt: Date;
  answers: { answeredAt: Date }[];
}): Date {
  let latest =
    row.updatedAt.getTime() > row.startedAt.getTime()
      ? row.updatedAt
      : row.startedAt;
  for (const answer of row.answers) {
    if (answer.answeredAt.getTime() > latest.getTime()) {
      latest = answer.answeredAt;
    }
  }
  return latest;
}

export function resolveBackfillLeadStatus(
  row: {
    status: AssessmentStatus;
    updatedAt: Date;
    startedAt: Date;
    answers: { answeredAt: Date }[];
  },
  incompleteAfterHours: number,
  now = new Date(),
): LeadStatus {
  if (row.status === "completed") {
    return "assessment_completed";
  }
  if (row.status === "abandoned") {
    return "assessment_incomplete";
  }

  const staleBefore = new Date(
    now.getTime() - incompleteAfterHours * 60 * 60 * 1000,
  );
  if (
    (row.status === "started" || row.status === "in_progress") &&
    lastActivityAt(row) < staleBefore
  ) {
    return "assessment_incomplete";
  }

  return "assessment_in_progress";
}

function matchesGroup(
  status: AssessmentStatus,
  group: LeadBackfillGroup,
): boolean {
  if (group === "all") return true;
  if (group === "completed") return status === "completed";
  if (group === "abandoned") return status === "abandoned";
  return status === "started" || status === "in_progress";
}

function isPipelineStatus(status: LeadStatus): boolean {
  return ASSESSMENT_PIPELINE_STATUSES.includes(status);
}

/** Prefer CRM leads over system-pipeline duplicates; then activity; then older. */
export function pickCanonicalLead<
  T extends {
    id: string;
    status: LeadStatus;
    assignedToId: string | null;
    createdAt: Date;
    _count: { leadActivities: number; consultationNotes: number };
  },
>(leads: T[]): T {
  return [...leads].sort((left, right) => {
    const leftCrm = isPipelineStatus(left.status) ? 0 : 1;
    const rightCrm = isPipelineStatus(right.status) ? 0 : 1;
    if (leftCrm !== rightCrm) {
      return rightCrm - leftCrm;
    }

    const leftAssigned = left.assignedToId ? 1 : 0;
    const rightAssigned = right.assignedToId ? 1 : 0;
    if (leftAssigned !== rightAssigned) {
      return rightAssigned - leftAssigned;
    }

    const leftActivity =
      left._count.leadActivities + left._count.consultationNotes;
    const rightActivity =
      right._count.leadActivities + right._count.consultationNotes;
    if (leftActivity !== rightActivity) {
      return rightActivity - leftActivity;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  })[0]!;
}

async function findLatestAssessmentsPerUser(input: {
  group: LeadBackfillGroup;
  limit?: number;
}): Promise<LatestAssessment[]> {
  const rows = await db.assessmentSession.findMany({
    where:
      input.group === "completed"
        ? { status: "completed" }
        : input.group === "abandoned"
          ? { status: "abandoned" }
          : input.group === "active"
            ? { status: { in: ["started", "in_progress"] } }
            : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      userId: true,
      status: true,
      updatedAt: true,
      startedAt: true,
      createdAt: true,
      user: {
        select: { name: true, phone: true, email: true },
      },
      organization: {
        select: { businessName: true },
      },
      report: {
        select: { id: true },
      },
      answers: {
        select: { answeredAt: true },
        orderBy: { answeredAt: "desc" },
        take: 1,
      },
    },
  });

  const latestByUser = new Map<string, LatestAssessment>();
  for (const row of rows) {
    if (!matchesGroup(row.status, input.group) && input.group !== "all") {
      continue;
    }
    // First row per user wins because list is newest-first.
    if (!latestByUser.has(row.userId)) {
      latestByUser.set(row.userId, row);
    }
  }

  const latest = [...latestByUser.values()].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  return input.limit ? latest.slice(0, input.limit) : latest;
}

/**
 * One lead per person. Stage comes from that person's latest assessment.
 * Dedupes extras, creates missing system leads, and soft-assigns without SMS.
 */
export async function backfillAssessmentLeads(input: {
  group?: LeadBackfillGroup;
  dryRun?: boolean;
  limit?: number;
}): Promise<LeadBackfillResult> {
  const group = input.group ?? "all";
  const dryRun = input.dryRun ?? false;
  const settings = await getLeadSettings();
  const latestAssessments = await findLatestAssessmentsPerUser({
    group,
    limit: input.limit,
  });

  const result: LeadBackfillResult = {
    dryRun,
    group,
    eligible: latestAssessments.length,
    created: 0,
    assigned: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
    failed: 0,
  };

  for (const latest of latestAssessments) {
    const pipelineStatus = resolveBackfillLeadStatus(
      latest,
      settings.assessmentIncompleteAfterHours,
    );
    const name =
      latest.user.name?.trim() || latest.organization.businessName || "کاربر";

    try {
      const existingLeads = await findConsultationRequestsByUserId(
        latest.userId,
      );

      if (existingLeads.length === 0) {
        if (settings.pauseSystemLeadCreation) {
          result.skipped += 1;
          continue;
        }

        if (dryRun) {
          console.log(
            `[dry-run] create user=${latest.userId} assessment=${latest.id} → ${pipelineStatus}`,
          );
          result.created += 1;
          continue;
        }

        const lead = await createConsultationRequest({
          name,
          phone: latest.user.phone ?? undefined,
          email: latest.user.email ?? undefined,
          assessmentSessionId: latest.id,
          reportId: latest.report?.id,
          source: "system",
          status: pipelineStatus,
        });
        result.created += 1;

        await finalizeNewLead(lead.id, {
          assessmentSessionId: latest.id,
          mode: "immediate",
          notifyExpert: false,
        });

        const assigned = await db.consultationRequest.findUnique({
          where: { id: lead.id },
          select: { assignedToId: true },
        });
        if (assigned?.assignedToId) {
          result.assigned += 1;
        } else {
          result.skipped += 1;
        }
        continue;
      }

      const keeper = pickCanonicalLead(existingLeads);
      const duplicateIds = existingLeads
        .filter((lead) => lead.id !== keeper.id)
        .map((lead) => lead.id);

      const nextStatus = isPipelineStatus(keeper.status)
        ? pipelineStatus
        : keeper.status;

      if (dryRun) {
        console.log(
          `[dry-run] reconcile user=${latest.userId} keep=${keeper.id} delete=${duplicateIds.length} status=${keeper.status}→${nextStatus} assessment=${latest.id}`,
        );
        result.updated += 1;
        result.deleted += duplicateIds.length;
        continue;
      }

      await updateLeadAssessmentBinding(keeper.id, {
        assessmentSessionId: latest.id,
        ...(latest.report?.id ? { reportId: latest.report.id } : {}),
        status: nextStatus,
        name,
        phone: latest.user.phone,
        email: latest.user.email,
      });
      result.updated += 1;

      if (duplicateIds.length > 0) {
        const deleted = await deleteConsultationRequestsByIds(duplicateIds);
        result.deleted += deleted.count;
      }

      if (!keeper.assignedToId) {
        await finalizeNewLead(keeper.id, {
          assessmentSessionId: latest.id,
          mode: "immediate",
          notifyExpert: false,
        });
        const assigned = await db.consultationRequest.findUnique({
          where: { id: keeper.id },
          select: { assignedToId: true },
        });
        if (assigned?.assignedToId) {
          result.assigned += 1;
        }
      }
    } catch (error) {
      result.failed += 1;
      console.error(
        `[lead-backfill] failed for user ${latest.userId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log(
    `[lead-backfill] group=${group} dryRun=${dryRun} eligible=${result.eligible} created=${result.created} updated=${result.updated} deleted=${result.deleted} assigned=${result.assigned} skipped=${result.skipped} failed=${result.failed}`,
  );

  return result;
}
