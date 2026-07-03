import { createSmsSenderFromSettings } from "@/modules/auth/sms/kavenegar";
import { buildBrandedSmsMessage } from "./branding";
import { evaluateSendGuard } from "./guards";
import {
  createFunnelEvent,
  findEnrollmentById,
  findSmsMessageByDedupeKey,
  findUserPhone,
  incrementEnrollmentSentCount,
  stopEnrollmentsForUser,
  updateEnrollmentStep,
  updateSmsMessageStatus,
} from "./funnel.repository";
import { nextAllowedSmsSendTime } from "./quiet-hours";
import {
  getFunnelSettings,
  getResolvedStep,
} from "./funnel-config.service";
import { resolveStepBody, stepIncludesLink } from "./sequences";
import type { SequenceKey } from "./sequences";
import { createTrackedShortLink } from "./short-link.service";
import type { SmsFunnelJobPayload } from "./sms-funnel.types";

export async function processSmsFunnelJob(
  payload: SmsFunnelJobPayload,
): Promise<void> {
  const existing = await findSmsMessageByDedupeKey(payload.dedupeKey);
  if (!existing) return;
  if (existing.status === "sent" || existing.status === "canceled") {
    return;
  }

  const enrollment = await findEnrollmentById(payload.enrollmentId);
  if (!enrollment) {
    await updateSmsMessageStatus(existing.id, {
      status: "canceled",
      error: "enrollment_not_found",
    });
    return;
  }

  const sequenceKey = payload.sequenceKey as SequenceKey;
  const step = await getResolvedStep(sequenceKey, payload.stepKey);
  if (!step || !step.enabled) {
    await updateSmsMessageStatus(existing.id, {
      status: "skipped",
      error: "step_not_found",
    });
    return;
  }

  const guard = await evaluateSendGuard({
    enrollmentId: payload.enrollmentId,
    step,
  });

  if (!guard.allowed) {
    await updateSmsMessageStatus(existing.id, {
      status: "skipped",
      error: guard.reason,
    });

    if (guard.reason === "max_unanswered_reached") {
      await stopEnrollmentsForUser({
        userId: enrollment.userId,
        assessmentSessionId: enrollment.assessmentSessionId ?? undefined,
        status: "stopped",
      });
    }

    if (guard.reason === "converted" || guard.reason === "consultation_exists") {
      await stopEnrollmentsForUser({
        userId: enrollment.userId,
        assessmentSessionId: enrollment.assessmentSessionId ?? undefined,
        sequenceKeys: ["seq_nurture", "seq_form_abandon", "seq_report_ready"],
        status: "converted",
      });
    }

    return;
  }

  const settings = await getFunnelSettings();
  const quietHours = {
    start: settings.quietHoursStart,
    end: settings.quietHoursEnd,
  };

  const sendAt = nextAllowedSmsSendTime(new Date(), quietHours);
  if (sendAt.getTime() > Date.now() + 60_000) {
    const delayMs = sendAt.getTime() - Date.now();
    const { enqueueSmsFunnelJob } = await import("./sms-funnel.queue");
    await enqueueSmsFunnelJob(payload, delayMs);
    return;
  }

  const phone = await findUserPhone(enrollment.userId);
  if (!phone) {
    await updateSmsMessageStatus(existing.id, {
      status: "failed",
      error: "phone_missing",
    });
    return;
  }

  let link: string | undefined;
  if (stepIncludesLink(step) && step.linkPurpose) {
    link = await createTrackedShortLink({
      purpose: step.linkPurpose,
      userId: enrollment.userId,
      assessmentSessionId: enrollment.assessmentSessionId ?? undefined,
      resultToken: enrollment.assessmentSession?.resultToken,
      reportId: enrollment.assessmentSession?.report?.id,
    });
  }

  const bodyText = resolveStepBody(step, enrollment.scoreBand);
  const message = buildBrandedSmsMessage(bodyText, link);

  try {
    const sender = await createSmsSenderFromSettings();
    const result = await sender.sendMessage(phone, message);

    await updateSmsMessageStatus(existing.id, {
      status: "sent",
      sentAt: new Date(),
      providerMessageId: result.providerMessageId,
    });
    await incrementEnrollmentSentCount(enrollment.id);
    await updateEnrollmentStep(enrollment.id, step.stepKey);
    await createFunnelEvent({
      userId: enrollment.userId,
      assessmentSessionId: enrollment.assessmentSessionId ?? undefined,
      type: "sms_sent",
      metadata: {
        stepKey: step.stepKey,
        sequenceKey: payload.sequenceKey,
      },
    });
  } catch (error) {
    await updateSmsMessageStatus(existing.id, {
      status: "failed",
      error: error instanceof Error ? error.message : "send_failed",
    });
    throw error;
  }
}
