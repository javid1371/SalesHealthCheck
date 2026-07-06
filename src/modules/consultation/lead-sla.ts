import type { LeadStatus, PurchaseProbability } from "@prisma/client";

export const STALE_NEW_LEAD_HOURS = 24;

const OPEN_LEAD_STATUSES: LeadStatus[] = [
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

export function computeLeadSlaFlags(row: {
  status: LeadStatus;
  createdAt: Date;
  nextFollowUpAt: Date | null;
  assignedToId: string | null;
  purchaseProbabilityBand: PurchaseProbability | null;
}): LeadSlaFlags {
  const now = new Date();
  const staleThreshold = new Date(
    now.getTime() - STALE_NEW_LEAD_HOURS * 60 * 60 * 1000,
  );

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
