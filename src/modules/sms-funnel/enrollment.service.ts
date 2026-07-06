import {
  createPendingSmsMessage,
  findSmsMessageByDedupeKey,
  findUserPhone,
  hasUserSmsForStep,
  stopEnrollmentsForUser,
  upsertFunnelEnrollment,
} from "./funnel.repository";
import { nextAllowedSmsSendTime } from "./quiet-hours";
import {
  getFunnelSettings,
  getResolvedSequence,
  isFunnelEnabledFromSettings,
} from "./funnel-config.service";
import type { SequenceKey } from "./sequences";
import { buildDedupeKey } from "./sms-funnel.types";
import { enqueueSmsFunnelJob } from "./sms-funnel.queue";
import { processSmsFunnelJob } from "./sms-funnel.processor";

export interface EnrollContext {
  userId: string;
  assessmentSessionId?: string;
  scoreBand?: import("@prisma/client").ScoreBand;
}

const NURTURE_SEQUENCES = [
  "seq_start",
  "seq_incomplete",
  "seq_report_ready",
  "seq_nurture",
  "seq_form_abandon",
] as const;

export async function enrollAndSchedule(
  sequenceKey: SequenceKey,
  ctx: EnrollContext,
): Promise<void> {
  const funnelEnabled = await isFunnelEnabledFromSettings();
  if (!funnelEnabled) return;

  const phone = await findUserPhone(ctx.userId);
  if (!phone) return;

  const settings = await getFunnelSettings();
  const enrollment = await upsertFunnelEnrollment({
    userId: ctx.userId,
    assessmentSessionId: ctx.assessmentSessionId,
    sequenceKey,
    scoreBand: ctx.scoreBand,
  });

  const sequence = await getResolvedSequence(sequenceKey);
  const triggeredAt = Date.now();
  const quietHours = {
    start: settings.quietHoursStart,
    end: settings.quietHoursEnd,
  };

  for (const step of sequence.steps) {
    const dedupeKey = buildDedupeKey(enrollment.id, step.stepKey);
    const existing = await findSmsMessageByDedupeKey(dedupeKey);
    if (existing) continue;

    const userAlreadyHasStep = await hasUserSmsForStep(
      ctx.userId,
      sequenceKey,
      step.stepKey,
    );
    if (userAlreadyHasStep) continue;

    const scheduledFor = nextAllowedSmsSendTime(
      new Date(triggeredAt + step.delayMs),
      quietHours,
    );
    const delayMs = Math.max(0, scheduledFor.getTime() - Date.now());

    const smsMessage = await createPendingSmsMessage({
      phone,
      body: step.body,
      sequenceKey,
      stepKey: step.stepKey,
      enrollmentId: enrollment.id,
      dedupeKey,
      scheduledFor,
    });

    const payload = {
      enrollmentId: enrollment.id,
      sequenceKey,
      stepKey: step.stepKey,
      dedupeKey,
      smsMessageId: smsMessage.id,
    };

    const queue = await import("./sms-funnel.queue").then((m) =>
      m.getSmsFunnelQueue(),
    );

    if (queue) {
      await enqueueSmsFunnelJob(payload, delayMs);
    } else if (delayMs === 0) {
      await processSmsFunnelJob(payload);
    }
  }
}

export async function stopNurtureSequences(input: {
  userId: string;
  assessmentSessionId?: string;
  converted?: boolean;
}): Promise<void> {
  await stopEnrollmentsForUser({
    userId: input.userId,
    assessmentSessionId: input.assessmentSessionId,
    sequenceKeys: [...NURTURE_SEQUENCES],
    status: input.converted ? "converted" : "stopped",
  });
}

export async function onPhoneVerified(userId: string): Promise<void> {
  await enrollAndSchedule("seq_start", { userId });
}

export async function onAssessmentStarted(
  userId: string,
  _assessmentSessionId: string,
): Promise<void> {
  await stopEnrollmentsForUser({
    userId,
    sequenceKeys: [...NURTURE_SEQUENCES],
    status: "stopped",
  });
}

export async function onAssessmentInProgress(
  userId: string,
  assessmentSessionId: string,
): Promise<void> {
  await stopEnrollmentsForUser({
    userId,
    sequenceKeys: ["seq_start"],
    status: "stopped",
  });
  await enrollAndSchedule("seq_incomplete", {
    userId,
    assessmentSessionId,
  });
}

export async function onAssessmentCompleted(input: {
  userId: string;
  assessmentSessionId: string;
  scoreBand: import("@prisma/client").ScoreBand;
}): Promise<void> {
  await stopEnrollmentsForUser({
    userId: input.userId,
    assessmentSessionId: input.assessmentSessionId,
    sequenceKeys: ["seq_incomplete", "seq_start"],
    status: "stopped",
  });

  await enrollAndSchedule("seq_report_ready", {
    userId: input.userId,
    assessmentSessionId: input.assessmentSessionId,
    scoreBand: input.scoreBand,
  });
}

export async function onReportViewed(
  userId: string,
  assessmentSessionId: string,
  scoreBand?: import("@prisma/client").ScoreBand,
): Promise<void> {
  await enrollAndSchedule("seq_nurture", {
    userId,
    assessmentSessionId,
    scoreBand,
  });
}

export async function onConsultationStarted(
  userId: string,
  assessmentSessionId: string,
): Promise<void> {
  await enrollAndSchedule("seq_form_abandon", {
    userId,
    assessmentSessionId,
  });
}

export async function onConsultationSubmitted(
  userId: string,
  assessmentSessionId: string,
): Promise<void> {
  await stopNurtureSequences({
    userId,
    assessmentSessionId,
    converted: true,
  });

  await enrollAndSchedule("seq_call_scheduled", {
    userId,
    assessmentSessionId,
  });
}
