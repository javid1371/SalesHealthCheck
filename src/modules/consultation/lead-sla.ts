import type { LeadStatus, PurchaseProbability } from "@prisma/client";

/** Fallback when lead setting `stale_new_lead_hours` is unset. */
export const STALE_NEW_LEAD_HOURS = 24;

const OPEN_LEAD_STATUSES: LeadStatus[] = [
  "assessment_in_progress",
  "assessment_incomplete",
  "assessment_completed",
  "new",
  "contacted",
  "meeting_scheduled",
  "unreachable",
];

export type LeadSlaSeverity = "none" | "amber" | "red";

export interface LeadSlaFlags {
  staleNew: boolean;
  overdueFollowUp: boolean;
  highProbabilityUnassigned: boolean;
  severity: LeadSlaSeverity;
}

export function computeLeadSlaFlags(
  row: {
    status: LeadStatus;
    createdAt: Date;
    nextFollowUpAt: Date | null;
    assignedToId: string | null;
    purchaseProbabilityBand: PurchaseProbability | null;
  },
  staleNewLeadHours: number = STALE_NEW_LEAD_HOURS,
): LeadSlaFlags {
  const hours =
    Number.isFinite(staleNewLeadHours) && staleNewLeadHours > 0
      ? staleNewLeadHours
      : STALE_NEW_LEAD_HOURS;
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - hours * 60 * 60 * 1000);

  const staleNew = row.status === "new" && row.createdAt < staleThreshold;
  const overdueFollowUp = Boolean(
    row.nextFollowUpAt &&
      row.nextFollowUpAt < now &&
      OPEN_LEAD_STATUSES.includes(row.status),
  );
  const highProbabilityUnassigned =
    row.assignedToId == null && row.purchaseProbabilityBand === "high";

  let severity: LeadSlaSeverity = "none";
  if (overdueFollowUp) {
    severity = "red";
  } else if (staleNew || highProbabilityUnassigned) {
    severity = "amber";
  }

  return {
    staleNew,
    overdueFollowUp,
    highProbabilityUnassigned,
    severity,
  };
}

export function slaReasonLabel(flags: LeadSlaFlags): string | null {
  if (flags.overdueFollowUp) {
    return "پیگیری عقب‌افتاده";
  }
  if (flags.highProbabilityUnassigned) {
    return "احتمال بالا — بدون تخصیص";
  }
  if (flags.staleNew) {
    return "لید جدید کهنه";
  }
  return null;
}

export type LeadActionHintSeverity = "red" | "amber" | "neutral";

export interface LeadActionHint {
  text: string;
  severity: LeadActionHintSeverity;
}

/**
 * Single next-action line for lead detail.
 * Priority: SLA reason → follow-up due today/overdue → last call → ready for first call.
 */
export function resolveLeadActionHint(input: {
  sla: LeadSlaFlags;
  slaReason: string | null;
  nextFollowUpAtIso: string | null;
  lastCallOutcomeLabel: string | null;
  status: LeadStatus;
  now?: Date;
}): LeadActionHint | null {
  if (input.sla.severity !== "none" && input.slaReason) {
    return {
      text: input.slaReason,
      severity: input.sla.severity,
    };
  }

  const now = input.now ?? new Date();
  if (input.nextFollowUpAtIso) {
    const followUpAt = new Date(input.nextFollowUpAtIso);
    if (!Number.isNaN(followUpAt.getTime())) {
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);
      if (followUpAt < now) {
        return { text: "پیگیری عقب‌افتاده", severity: "red" };
      }
      if (followUpAt <= endOfToday) {
        return { text: "پیگیری امروز", severity: "amber" };
      }
    }
  }

  if (input.lastCallOutcomeLabel) {
    return {
      text: `آخرین تماس: ${input.lastCallOutcomeLabel}`,
      severity: "neutral",
    };
  }

  if (input.status === "new") {
    return { text: "آماده اولین تماس", severity: "neutral" };
  }

  return null;
}
