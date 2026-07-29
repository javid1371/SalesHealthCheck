import type { LeadStatus, PurchaseProbability } from "@prisma/client";
import type { FirstContactSlaMinutesByBand } from "./lead-config.service";
import { DEFAULT_ROUTING_RULES } from "./lead-config.service";

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
  firstContactSlaBreached: boolean;
  severity: LeadSlaSeverity;
}

export type LeadSlaOptions = {
  staleNewLeadHours?: number;
  firstContactedAt?: Date | null;
  firstContactSlaMinutesByBand?: FirstContactSlaMinutesByBand;
  now?: Date;
};

export function resolveFirstContactSlaMinutes(
  band: PurchaseProbability | null | undefined,
  minutesByBand: FirstContactSlaMinutesByBand = DEFAULT_ROUTING_RULES.firstContactSlaMinutesByBand,
): number {
  if (band === "high") {
    return minutesByBand.high;
  }
  if (band === "low") {
    return minutesByBand.low;
  }
  return minutesByBand.mid;
}

export function isFirstContactSlaBreached(input: {
  status: LeadStatus;
  createdAt: Date;
  firstContactedAt?: Date | null;
  purchaseProbabilityBand: PurchaseProbability | null;
  firstContactSlaMinutesByBand?: FirstContactSlaMinutesByBand;
  now?: Date;
}): boolean {
  if (!OPEN_LEAD_STATUSES.includes(input.status)) {
    return false;
  }
  if (input.firstContactedAt) {
    return false;
  }

  const minutes = resolveFirstContactSlaMinutes(
    input.purchaseProbabilityBand,
    input.firstContactSlaMinutesByBand,
  );
  const now = input.now ?? new Date();
  const deadline = new Date(input.createdAt.getTime() + minutes * 60 * 1000);
  return now > deadline;
}

export function computeLeadSlaFlags(
  row: {
    status: LeadStatus;
    createdAt: Date;
    nextFollowUpAt: Date | null;
    assignedToId: string | null;
    purchaseProbabilityBand: PurchaseProbability | null;
    firstContactedAt?: Date | null;
  },
  staleNewLeadHoursOrOptions: number | LeadSlaOptions = STALE_NEW_LEAD_HOURS,
): LeadSlaFlags {
  const options: LeadSlaOptions =
    typeof staleNewLeadHoursOrOptions === "number"
      ? { staleNewLeadHours: staleNewLeadHoursOrOptions }
      : staleNewLeadHoursOrOptions;

  const hours =
    Number.isFinite(options.staleNewLeadHours) &&
    (options.staleNewLeadHours ?? 0) > 0
      ? (options.staleNewLeadHours as number)
      : STALE_NEW_LEAD_HOURS;
  const now = options.now ?? new Date();
  const staleThreshold = new Date(now.getTime() - hours * 60 * 60 * 1000);

  const staleNew = row.status === "new" && row.createdAt < staleThreshold;
  const overdueFollowUp = Boolean(
    row.nextFollowUpAt &&
      row.nextFollowUpAt < now &&
      OPEN_LEAD_STATUSES.includes(row.status),
  );
  const highProbabilityUnassigned =
    row.assignedToId == null && row.purchaseProbabilityBand === "high";
  const firstContactSlaBreached = isFirstContactSlaBreached({
    status: row.status,
    createdAt: row.createdAt,
    firstContactedAt: row.firstContactedAt ?? options.firstContactedAt,
    purchaseProbabilityBand: row.purchaseProbabilityBand,
    firstContactSlaMinutesByBand: options.firstContactSlaMinutesByBand,
    now,
  });

  let severity: LeadSlaSeverity = "none";
  if (overdueFollowUp) {
    severity = "red";
  } else if (
    firstContactSlaBreached &&
    row.purchaseProbabilityBand === "high"
  ) {
    severity = "red";
  } else if (
    staleNew ||
    highProbabilityUnassigned ||
    firstContactSlaBreached
  ) {
    severity = "amber";
  }

  return {
    staleNew,
    overdueFollowUp,
    highProbabilityUnassigned,
    firstContactSlaBreached,
    severity,
  };
}

export function slaReasonLabel(flags: LeadSlaFlags): string | null {
  if (flags.overdueFollowUp) {
    return "پیگیری عقب‌افتاده";
  }
  if (flags.firstContactSlaBreached) {
    return "گذشته از SLA تماس اول";
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
