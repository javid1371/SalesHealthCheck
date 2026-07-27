import type { AssessmentStatus, LeadStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { createConsultationRequest } from "./consultation.repository";
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
  skipped: number;
  failed: number;
}

type Candidate = {
  id: string;
  status: AssessmentStatus;
  updatedAt: Date;
  startedAt: Date;
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

function lastActivityAt(row: Candidate): Date {
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
  row: Candidate,
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

async function findCandidates(input: {
  group: LeadBackfillGroup;
  limit?: number;
}): Promise<Candidate[]> {
  const rows = await db.assessmentSession.findMany({
    where: {
      consultationRequests: { none: {} },
      ...(input.group === "completed"
        ? { status: "completed" }
        : input.group === "abandoned"
          ? { status: "abandoned" }
          : input.group === "active"
            ? { status: { in: ["started", "in_progress"] } }
            : {}),
    },
    orderBy: { createdAt: "asc" },
    take: input.limit,
    select: {
      id: true,
      status: true,
      updatedAt: true,
      startedAt: true,
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

  return rows.filter((row) => matchesGroup(row.status, input.group));
}

/**
 * Creates system leads for assessments that predate auto lead-on-start,
 * then soft-assigns them via round-robin (no expert SMS flood).
 */
export async function backfillAssessmentLeads(input: {
  group?: LeadBackfillGroup;
  dryRun?: boolean;
  limit?: number;
}): Promise<LeadBackfillResult> {
  const group = input.group ?? "all";
  const dryRun = input.dryRun ?? false;
  const settings = await getLeadSettings();
  const candidates = await findCandidates({
    group,
    limit: input.limit,
  });

  const result: LeadBackfillResult = {
    dryRun,
    group,
    eligible: candidates.length,
    created: 0,
    assigned: 0,
    skipped: 0,
    failed: 0,
  };

  for (const row of candidates) {
    const status = resolveBackfillLeadStatus(
      row,
      settings.assessmentIncompleteAfterHours,
    );
    const name =
      row.user.name?.trim() || row.organization.businessName || "کاربر";

    if (dryRun) {
      console.log(
        `[dry-run] ${row.id} status=${row.status} → lead=${status} name=${name}`,
      );
      result.created += 1;
      continue;
    }

    try {
      const lead = await createConsultationRequest({
        name,
        phone: row.user.phone ?? undefined,
        email: row.user.email ?? undefined,
        assessmentSessionId: row.id,
        reportId: row.report?.id,
        source: "system",
        status,
      });
      result.created += 1;

      await finalizeNewLead(lead.id, {
        assessmentSessionId: row.id,
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
    } catch (error) {
      result.failed += 1;
      console.error(
        `[lead-backfill] failed for assessment ${row.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log(
    `[lead-backfill] group=${group} dryRun=${dryRun} eligible=${result.eligible} created=${result.created} assigned=${result.assigned} skipped=${result.skipped} failed=${result.failed}`,
  );

  return result;
}
