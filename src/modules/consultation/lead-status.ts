import type { LeadStatus } from "@prisma/client";

/**
 * Default expert call-queue priority (lower = contact sooner).
 * `assessment_in_progress` stays visible on the board but last in the call queue.
 */
export const LEAD_CALL_QUEUE_PRIORITY: Record<LeadStatus, number> = {
  new: 0,
  assessment_completed: 1,
  assessment_incomplete: 2,
  contacted: 3,
  meeting_scheduled: 4,
  unreachable: 5,
  closed_won: 6,
  closed_lost: 7,
  assessment_in_progress: 8,
};

export function compareLeadsByCallQueuePriority(
  left: { status: LeadStatus; createdAt: Date },
  right: { status: LeadStatus; createdAt: Date },
): number {
  const byStatus =
    LEAD_CALL_QUEUE_PRIORITY[left.status] -
    LEAD_CALL_QUEUE_PRIORITY[right.status];
  if (byStatus !== 0) {
    return byStatus;
  }
  return right.createdAt.getTime() - left.createdAt.getTime();
}

/** Manual entry into assessment_in_progress is system-owned; leaving it is allowed. */
export function isManualStatusTransitionAllowed(
  from: LeadStatus,
  to: LeadStatus,
): boolean {
  if (to === "assessment_in_progress" && from !== "assessment_in_progress") {
    return false;
  }
  return true;
}
