import type { ScoreBand } from "@prisma/client";
import {
  countConsultationRequests,
  findEnrollmentById,
  findUserPhone,
  hasFunnelEvent,
  isPhoneOptedOut,
  userHasInProgressOrCompletedAssessment,
} from "./funnel.repository";
import {
  getFunnelSettings,
  isFunnelEnabledFromSettings,
} from "./funnel-config.service";
import type { SequenceStepDefinition } from "./sequences";

export type GuardSkipReason =
  | "funnel_disabled"
  | "opt_out"
  | "enrollment_inactive"
  | "converted"
  | "assessment_completed"
  | "assessment_not_in_progress"
  | "report_already_viewed"
  | "consultation_exists"
  | "consultation_not_started"
  | "consultation_already_submitted"
  | "max_unanswered_reached"
  | "assessment_not_completed"
  | "assessment_already_started";

export interface GuardContext {
  enrollmentId: string;
  step: SequenceStepDefinition;
}

export interface GuardResult {
  allowed: boolean;
  reason?: GuardSkipReason;
}

export async function evaluateSendGuard(
  ctx: GuardContext,
): Promise<GuardResult> {
  const [funnelEnabled, settings] = await Promise.all([
    isFunnelEnabledFromSettings(),
    getFunnelSettings(),
  ]);

  if (!funnelEnabled) {
    return { allowed: false, reason: "funnel_disabled" };
  }

  const enrollment = await findEnrollmentById(ctx.enrollmentId);
  if (!enrollment) {
    return { allowed: false, reason: "enrollment_inactive" };
  }

  if (enrollment.status !== "active") {
    return {
      allowed: false,
      reason:
        enrollment.status === "converted" ? "converted" : "enrollment_inactive",
    };
  }

  const phone = await findUserPhone(enrollment.userId);
  if (phone && (await isPhoneOptedOut(phone))) {
    return { allowed: false, reason: "opt_out" };
  }

  if (enrollment.messagesSentCount >= settings.maxUnanswered) {
    const hasRecentReaction = enrollment.assessmentSessionId
      ? (await hasFunnelEvent(enrollment.assessmentSessionId, "link_clicked")) ||
        (await hasFunnelEvent(
          enrollment.assessmentSessionId,
          "report_viewed",
        )) ||
        (await hasFunnelEvent(
          enrollment.assessmentSessionId,
          "consultation_started",
        ))
      : false;

    if (!hasRecentReaction) {
      return { allowed: false, reason: "max_unanswered_reached" };
    }
  }

  const assessmentId = enrollment.assessmentSessionId;
  const assessment = enrollment.assessmentSession;

  if (ctx.step.requiresNoReportView && assessmentId) {
    if (await hasFunnelEvent(assessmentId, "report_viewed")) {
      return { allowed: false, reason: "report_already_viewed" };
    }
  }

  if (ctx.step.requiresNoConsultation && assessmentId) {
    if ((await countConsultationRequests(assessmentId)) > 0) {
      return { allowed: false, reason: "consultation_exists" };
    }
  }

  if (ctx.step.requiresNoConsultationSubmit && assessmentId) {
    if ((await countConsultationRequests(assessmentId)) > 0) {
      return { allowed: false, reason: "consultation_already_submitted" };
    }
    if (!(await hasFunnelEvent(assessmentId, "consultation_started"))) {
      return { allowed: false, reason: "consultation_not_started" };
    }
  }

  if (enrollment.sequenceKey === "seq_incomplete") {
    if (!assessment || assessment.status !== "in_progress") {
      return {
        allowed: false,
        reason:
          assessment?.status === "completed"
            ? "assessment_completed"
            : "assessment_not_in_progress",
      };
    }
  }

  if (
    enrollment.sequenceKey === "seq_report_ready" ||
    enrollment.sequenceKey === "seq_nurture"
  ) {
    if (!assessment || assessment.status !== "completed") {
      return { allowed: false, reason: "assessment_not_completed" };
    }
  }

  if (enrollment.sequenceKey === "seq_start") {
    if (await userHasInProgressOrCompletedAssessment(enrollment.userId)) {
      return { allowed: false, reason: "assessment_already_started" };
    }
    if (assessment && assessment.status !== "started") {
      return { allowed: false, reason: "assessment_not_in_progress" };
    }
  }

  return { allowed: true };
}

export function resolveScoreBandFromEnrollment(
  scoreBand: ScoreBand | null | undefined,
): ScoreBand | null {
  return scoreBand ?? null;
}
