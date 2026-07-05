import type { AssessmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { isFunnelEnabledFromSettings } from "./funnel-config.service";
import {
  enrollAndSchedule,
  onAssessmentCompleted,
  onAssessmentInProgress,
  onReportViewed,
} from "./enrollment.service";
import { resolveScoreBand } from "./score-band";

export type BackfillGroup =
  | "in_progress"
  | "completed"
  | "started"
  | "report_viewed"
  | "all";

const BACKFILL_GROUP_ORDER: Exclude<BackfillGroup, "all">[] = [
  "in_progress",
  "completed",
  "started",
  "report_viewed",
];

const GROUP_TARGET_SEQUENCE: Record<
  Exclude<BackfillGroup, "all">,
  string
> = {
  in_progress: "seq_incomplete",
  completed: "seq_report_ready",
  started: "seq_start",
  report_viewed: "seq_nurture",
};

export interface BackfillCandidate {
  userId: string;
  assessmentSessionId: string | null;
  businessName: string | null;
  scorePercentage: number | null;
  group: Exclude<BackfillGroup, "all">;
}

export interface CandidateRow {
  userId: string;
  assessmentSessionId: string;
  status: AssessmentStatus;
  phone: string;
  businessName: string | null;
  scorePercentage: number | null;
  hasActiveTargetEnrollment: boolean;
  isOptedOut: boolean;
  hasConsultation: boolean;
  hasReportViewed: boolean;
}

export interface RunBackfillInput {
  group: BackfillGroup;
  dryRun: boolean;
  limit?: number;
}

export interface RunBackfillResult {
  group: BackfillGroup;
  dryRun: boolean;
  eligible: number;
  processed: number;
  succeeded: number;
  failed: number;
}

export function isEligibleForBackfillGroup(
  row: CandidateRow,
  group: Exclude<BackfillGroup, "all">,
): boolean {
  if (row.isOptedOut) return false;
  if (row.hasActiveTargetEnrollment) return false;

  switch (group) {
    case "in_progress":
      return row.status === "in_progress";
    case "completed":
      return row.status === "completed" && !row.hasConsultation;
    case "started":
      return row.status === "started";
    case "report_viewed":
      return (
        row.status === "completed" &&
        row.hasReportViewed &&
        !row.hasConsultation
      );
    default:
      return false;
  }
}

function resolveGroups(group: BackfillGroup): Exclude<BackfillGroup, "all">[] {
  if (group === "all") return [...BACKFILL_GROUP_ORDER];
  return [group];
}

async function loadLatestAssessmentRows(): Promise<
  Omit<
    CandidateRow,
    | "hasActiveTargetEnrollment"
    | "isOptedOut"
    | "hasConsultation"
    | "hasReportViewed"
  >[]
> {
  const sessions = await db.assessmentSession.findMany({
    where: { user: { phone: { not: null } } },
    select: {
      id: true,
      userId: true,
      status: true,
      organization: { select: { businessName: true } },
      overallScore: { select: { percentage: true } },
      user: { select: { phone: true } },
    },
    orderBy: { startedAt: "desc" },
  });

  const seenUsers = new Set<string>();
  const latest: Omit<
    CandidateRow,
    | "hasActiveTargetEnrollment"
    | "isOptedOut"
    | "hasConsultation"
    | "hasReportViewed"
  >[] = [];

  for (const session of sessions) {
    if (seenUsers.has(session.userId)) continue;
    seenUsers.add(session.userId);

    const phone = session.user.phone;
    if (!phone) continue;

    latest.push({
      userId: session.userId,
      assessmentSessionId: session.id,
      status: session.status,
      phone,
      businessName: session.organization.businessName,
      scorePercentage: session.overallScore?.percentage ?? null,
    });
  }

  return latest;
}

async function enrichCandidateRows(
  rows: Omit<
    CandidateRow,
    | "hasActiveTargetEnrollment"
    | "isOptedOut"
    | "hasConsultation"
    | "hasReportViewed"
  >[],
  group: Exclude<BackfillGroup, "all">,
): Promise<CandidateRow[]> {
  if (rows.length === 0) return [];

  const phones = [...new Set(rows.map((row) => row.phone))];
  const userIds = rows.map((row) => row.userId);
  const assessmentIds = rows.map((row) => row.assessmentSessionId);
  const targetSequence = GROUP_TARGET_SEQUENCE[group];

  const [optOuts, enrollments, consultations, reportViewedEvents] =
    await Promise.all([
      db.smsOptOut.findMany({
        where: { phone: { in: phones } },
        select: { phone: true },
      }),
      db.funnelEnrollment.findMany({
        where: {
          userId: { in: userIds },
          sequenceKey: targetSequence,
          status: "active",
        },
        select: {
          userId: true,
          assessmentSessionId: true,
          sequenceKey: true,
        },
      }),
      db.consultationRequest.findMany({
        where: { assessmentSessionId: { in: assessmentIds } },
        select: { assessmentSessionId: true },
      }),
      db.funnelEvent.findMany({
        where: {
          assessmentSessionId: { in: assessmentIds },
          type: "report_viewed",
        },
        select: { assessmentSessionId: true },
      }),
    ]);

  const optedOutPhones = new Set(optOuts.map((row) => row.phone));
  const consultationSessions = new Set(
    consultations
      .map((row) => row.assessmentSessionId)
      .filter((id): id is string => id !== null),
  );
  const reportViewedSessions = new Set(
    reportViewedEvents
      .map((row) => row.assessmentSessionId)
      .filter((id): id is string => id !== null),
  );

  return rows.map((row) => ({
    ...row,
    isOptedOut: optedOutPhones.has(row.phone),
    hasConsultation: consultationSessions.has(row.assessmentSessionId),
    hasReportViewed: reportViewedSessions.has(row.assessmentSessionId),
    hasActiveTargetEnrollment: enrollments.some((enrollment) => {
      if (enrollment.userId !== row.userId) return false;
      if (group === "started") {
        return enrollment.assessmentSessionId === null;
      }
      return enrollment.assessmentSessionId === row.assessmentSessionId;
    }),
  }));
}

export async function findEligibleCandidates(
  group: BackfillGroup,
): Promise<BackfillCandidate[]> {
  const baseRows = await loadLatestAssessmentRows();
  const candidates: BackfillCandidate[] = [];

  for (const targetGroup of resolveGroups(group)) {
    const enriched = await enrichCandidateRows(baseRows, targetGroup);
    for (const row of enriched) {
      if (!isEligibleForBackfillGroup(row, targetGroup)) continue;
      candidates.push({
        userId: row.userId,
        assessmentSessionId:
          targetGroup === "started" ? null : row.assessmentSessionId,
        businessName: row.businessName,
        scorePercentage: row.scorePercentage,
        group: targetGroup,
      });
    }
  }

  return candidates;
}

async function enrollCandidate(candidate: BackfillCandidate): Promise<void> {
  switch (candidate.group) {
    case "in_progress":
      await onAssessmentInProgress(
        candidate.userId,
        candidate.assessmentSessionId!,
      );
      return;
    case "completed":
      await onAssessmentCompleted({
        userId: candidate.userId,
        assessmentSessionId: candidate.assessmentSessionId!,
        scoreBand: resolveScoreBand(candidate.scorePercentage ?? 0),
      });
      return;
    case "started":
      await enrollAndSchedule("seq_start", { userId: candidate.userId });
      return;
    case "report_viewed":
      await onReportViewed(
        candidate.userId,
        candidate.assessmentSessionId!,
        candidate.scorePercentage !== null
          ? resolveScoreBand(candidate.scorePercentage)
          : undefined,
      );
      return;
    default:
      throw new Error(`Unsupported backfill group: ${candidate.group}`);
  }
}

export async function runBackfill(
  input: RunBackfillInput,
): Promise<RunBackfillResult> {
  const funnelEnabled = await isFunnelEnabledFromSettings();
  if (!funnelEnabled) {
    throw new Error(
      "SMS funnel is disabled. Enable it in admin settings before running backfill.",
    );
  }

  const candidates = await findEligibleCandidates(input.group);
  const toProcess =
    input.limit !== undefined
      ? candidates.slice(0, Math.max(0, input.limit))
      : candidates;

  console.log(
    `Found ${candidates.length} eligible candidate(s) for group=${input.group}.`,
  );

  if (input.dryRun) {
    for (const candidate of toProcess) {
      console.log(
        `DRY  group=${candidate.group} user=${candidate.userId} assessment=${candidate.assessmentSessionId ?? "-"} business=${candidate.businessName ?? "-"}`,
      );
    }
    console.log(
      `Dry run complete. Would process ${toProcess.length} candidate(s).`,
    );
    return {
      group: input.group,
      dryRun: true,
      eligible: candidates.length,
      processed: toProcess.length,
      succeeded: 0,
      failed: 0,
    };
  }

  let succeeded = 0;
  let failed = 0;

  for (const candidate of toProcess) {
    try {
      await enrollCandidate(candidate);
      succeeded += 1;
      console.log(
        `OK   group=${candidate.group} user=${candidate.userId} assessment=${candidate.assessmentSessionId ?? "-"}`,
      );
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `FAIL group=${candidate.group} user=${candidate.userId} assessment=${candidate.assessmentSessionId ?? "-"}: ${message}`,
      );
    }
  }

  console.log(
    `Done. eligible=${candidates.length} processed=${toProcess.length} succeeded=${succeeded} failed=${failed}`,
  );

  return {
    group: input.group,
    dryRun: false,
    eligible: candidates.length,
    processed: toProcess.length,
    succeeded,
    failed,
  };
}
