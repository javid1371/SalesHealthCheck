import {
  cancelPendingSmsMessage,
  createPendingSmsMessage,
  findActiveCallScheduledEnrollment,
  findSmsMessageByDedupeKey,
  findUserPhone,
  hasUserSmsForStep,
  listPendingSmsForEnrollment,
  stopEnrollmentsForUser,
  updateSmsMessageScheduledFor,
  upsertFunnelEnrollment,
} from "./funnel.repository";
import { nextAllowedSmsSendTime } from "./quiet-hours";
import {
  getFunnelSettings,
  getResolvedSequence,
  isFunnelEnabledFromSettings,
} from "./funnel-config.service";
import {
  getCallScheduledOffsetMs,
  type SequenceKey,
} from "./sequences";
import { buildDedupeKey } from "./sms-funnel.types";
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

    const queueModule = await import("./sms-funnel.queue");
    const queue = queueModule.getSmsFunnelQueue();

    if (queue) {
      await queueModule.enqueueSmsFunnelJob(payload, delayMs);
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

export type CallScheduledRescheduleAction =
  | {
      type: "cancel";
      messageId: string;
      dedupeKey: string;
      stepKey: string;
    }
  | {
      type: "reschedule";
      messageId: string;
      dedupeKey: string;
      stepKey: string;
      sequenceKey: string;
      enrollmentId: string;
      scheduledFor: Date;
    };

/**
 * Pure planner: for each pending call-scheduled reminder, either cancel (send
 * time already past relative to follow-up) or reschedule to follow-up + offset.
 * Confirmation step S6-1 (no callOffsetMs) is left untouched.
 */
export function planCallScheduledReschedule(input: {
  pendingMessages: Array<{
    id: string;
    stepKey: string;
    dedupeKey: string;
    enrollmentId: string;
    sequenceKey: string;
  }>;
  nextFollowUpAt: Date;
  now?: Date;
  resolveSendTime?: (raw: Date) => Date;
}): CallScheduledRescheduleAction[] {
  const now = input.now ?? new Date();
  const resolveSendTime = input.resolveSendTime ?? ((raw: Date) => raw);
  const actions: CallScheduledRescheduleAction[] = [];

  for (const message of input.pendingMessages) {
    const offsetMs = getCallScheduledOffsetMs(message.stepKey);
    if (offsetMs === null) continue;

    const rawAt = new Date(input.nextFollowUpAt.getTime() + offsetMs);
    if (rawAt.getTime() <= now.getTime()) {
      actions.push({
        type: "cancel",
        messageId: message.id,
        dedupeKey: message.dedupeKey,
        stepKey: message.stepKey,
      });
      continue;
    }

    const scheduledFor = resolveSendTime(rawAt);
    actions.push({
      type: "reschedule",
      messageId: message.id,
      dedupeKey: message.dedupeKey,
      stepKey: message.stepKey,
      sequenceKey: message.sequenceKey,
      enrollmentId: message.enrollmentId,
      scheduledFor,
    });
  }

  return actions;
}

/**
 * When CRM sets/changes `nextFollowUpAt`, realign pending `seq_call_scheduled`
 * reminder SMS to that call time. Clearing follow-up leaves submit schedules alone.
 * Does not change CRM lead status.
 */
export async function rescheduleCallScheduledForFollowUp(input: {
  userId: string;
  assessmentSessionId?: string | null;
  nextFollowUpAt: Date;
  now?: Date;
}): Promise<void> {
  const enrollment = await findActiveCallScheduledEnrollment({
    userId: input.userId,
    assessmentSessionId: input.assessmentSessionId,
  });
  if (!enrollment) return;

  const pending = await listPendingSmsForEnrollment(enrollment.id);
  if (pending.length === 0) return;

  const settings = await getFunnelSettings();
  const quietHours = {
    start: settings.quietHoursStart,
    end: settings.quietHoursEnd,
  };

  const actions = planCallScheduledReschedule({
    pendingMessages: pending,
    nextFollowUpAt: input.nextFollowUpAt,
    now: input.now,
    resolveSendTime: (raw) => nextAllowedSmsSendTime(raw, quietHours),
  });

  const now = input.now ?? new Date();

  const queueModule = await import("./sms-funnel.queue");

  for (const action of actions) {
    if (action.type === "cancel") {
      await cancelPendingSmsMessage(action.messageId, "follow_up_reschedule_past");
      await queueModule.removeSmsFunnelJob(action.dedupeKey);
      continue;
    }

    await updateSmsMessageScheduledFor(action.messageId, action.scheduledFor);
    const delayMs = Math.max(0, action.scheduledFor.getTime() - now.getTime());
    await queueModule.rescheduleSmsFunnelJob(
      {
        enrollmentId: action.enrollmentId,
        sequenceKey: action.sequenceKey,
        stepKey: action.stepKey,
        dedupeKey: action.dedupeKey,
        smsMessageId: action.messageId,
      },
      delayMs,
    );
  }
}
