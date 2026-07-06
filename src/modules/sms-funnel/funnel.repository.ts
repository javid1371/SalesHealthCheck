import type {
  EnrollmentStatus,
  FunnelEventType,
  Prisma,
  ScoreBand,
  ShortLinkPurpose,
  SmsStatus,
} from "@prisma/client";
import { db } from "@/lib/db";

export async function findUserPhone(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { phone: true },
  });
  return user?.phone ?? null;
}

export async function isPhoneOptedOut(phone: string): Promise<boolean> {
  const record = await db.smsOptOut.findUnique({ where: { phone } });
  return Boolean(record);
}

export async function addPhoneOptOut(phone: string): Promise<void> {
  await db.smsOptOut.upsert({
    where: { phone },
    create: { phone },
    update: {},
  });
}

export async function createFunnelEvent(input: {
  userId?: string;
  assessmentSessionId?: string;
  type: FunnelEventType;
  metadata?: Prisma.InputJsonValue;
}) {
  return db.funnelEvent.create({
    data: {
      userId: input.userId,
      assessmentSessionId: input.assessmentSessionId,
      type: input.type,
      metadata: input.metadata,
    },
  });
}

export async function hasFunnelEvent(
  assessmentSessionId: string,
  type: FunnelEventType,
): Promise<boolean> {
  const event = await db.funnelEvent.findFirst({
    where: { assessmentSessionId, type },
    select: { id: true },
  });
  return Boolean(event);
}

export async function countConsultationRequests(
  assessmentSessionId: string,
): Promise<number> {
  return db.consultationRequest.count({
    where: { assessmentSessionId },
  });
}

export async function findAssessmentForFunnel(assessmentSessionId: string) {
  return db.assessmentSession.findUnique({
    where: { id: assessmentSessionId },
    select: {
      id: true,
      userId: true,
      status: true,
      resultToken: true,
      completedAt: true,
      report: { select: { id: true } },
      overallScore: { select: { percentage: true } },
    },
  });
}

export async function userHasInProgressOrCompletedAssessment(
  userId: string,
): Promise<boolean> {
  const session = await db.assessmentSession.findFirst({
    where: {
      userId,
      status: { in: ["in_progress", "completed"] },
    },
    select: { id: true },
  });
  return Boolean(session);
}

export async function upsertFunnelEnrollment(input: {
  userId: string;
  assessmentSessionId?: string | null;
  sequenceKey: string;
  scoreBand?: ScoreBand | null;
}) {
  const assessmentSessionId = input.assessmentSessionId ?? null;

  const existing = await db.funnelEnrollment.findFirst({
    where: {
      userId: input.userId,
      sequenceKey: input.sequenceKey,
      assessmentSessionId,
    },
  });

  if (existing) {
    if (existing.status === "converted") {
      return db.funnelEnrollment.update({
        where: { id: existing.id },
        data: {
          scoreBand: input.scoreBand ?? existing.scoreBand,
          lastEventAt: new Date(),
        },
      });
    }

    return db.funnelEnrollment.update({
      where: { id: existing.id },
      data: {
        status: "active",
        scoreBand: input.scoreBand ?? existing.scoreBand,
        lastEventAt: new Date(),
      },
    });
  }

  return db.funnelEnrollment.create({
    data: {
      userId: input.userId,
      assessmentSessionId,
      sequenceKey: input.sequenceKey,
      scoreBand: input.scoreBand ?? undefined,
      status: "active",
    },
  });
}

export async function stopEnrollmentsForUser(input: {
  userId: string;
  assessmentSessionId?: string;
  sequenceKeys?: string[];
  status: EnrollmentStatus;
}) {
  const result = await db.funnelEnrollment.updateMany({
    where: {
      userId: input.userId,
      ...(input.assessmentSessionId
        ? { assessmentSessionId: input.assessmentSessionId }
        : {}),
      ...(input.sequenceKeys ? { sequenceKey: { in: input.sequenceKeys } } : {}),
      status: "active",
    },
    data: {
      status: input.status,
      lastEventAt: new Date(),
    },
  });

  await cancelPendingSmsForEnrollments({
    userId: input.userId,
    assessmentSessionId: input.assessmentSessionId,
    sequenceKeys: input.sequenceKeys,
  });

  return result;
}

export async function cancelPendingSmsForEnrollments(input: {
  userId: string;
  assessmentSessionId?: string;
  sequenceKeys?: string[];
}) {
  return db.smsMessage.updateMany({
    where: {
      status: "pending",
      enrollment: {
        userId: input.userId,
        ...(input.assessmentSessionId
          ? { assessmentSessionId: input.assessmentSessionId }
          : {}),
        ...(input.sequenceKeys
          ? { sequenceKey: { in: input.sequenceKeys } }
          : {}),
      },
    },
    data: {
      status: "canceled",
      error: "enrollment_stopped",
    },
  });
}

export async function hasUserSmsForStep(
  userId: string,
  sequenceKey: string,
  stepKey: string,
): Promise<boolean> {
  const message = await db.smsMessage.findFirst({
    where: {
      sequenceKey,
      stepKey,
      status: { in: ["pending", "sent"] },
      enrollment: { userId },
    },
    select: { id: true },
  });
  return Boolean(message);
}

export async function findEnrollmentById(enrollmentId: string) {
  return db.funnelEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      assessmentSession: {
        select: {
          id: true,
          status: true,
          resultToken: true,
          report: { select: { id: true } },
        },
      },
    },
  });
}

export async function incrementEnrollmentSentCount(enrollmentId: string) {
  return db.funnelEnrollment.update({
    where: { id: enrollmentId },
    data: {
      messagesSentCount: { increment: 1 },
      lastEventAt: new Date(),
    },
  });
}

export async function updateEnrollmentStep(
  enrollmentId: string,
  stepKey: string,
) {
  return db.funnelEnrollment.update({
    where: { id: enrollmentId },
    data: { currentStep: stepKey, lastEventAt: new Date() },
  });
}

export async function createPendingSmsMessage(input: {
  phone: string;
  body: string;
  sequenceKey: string;
  stepKey: string;
  enrollmentId: string;
  dedupeKey: string;
  scheduledFor: Date;
}) {
  return db.smsMessage.create({
    data: {
      phone: input.phone,
      body: input.body,
      sequenceKey: input.sequenceKey,
      stepKey: input.stepKey,
      enrollmentId: input.enrollmentId,
      dedupeKey: input.dedupeKey,
      scheduledFor: input.scheduledFor,
      status: "pending",
    },
  });
}

export async function updateSmsMessageStatus(
  id: string,
  data: {
    status: SmsStatus;
    sentAt?: Date;
    providerMessageId?: string;
    error?: string;
  },
) {
  return db.smsMessage.update({
    where: { id },
    data,
  });
}

export async function findSmsMessageByDedupeKey(dedupeKey: string) {
  return db.smsMessage.findUnique({ where: { dedupeKey } });
}

export async function createShortLink(input: {
  slug: string;
  targetUrl: string;
  userId?: string;
  assessmentSessionId?: string;
  purpose: ShortLinkPurpose;
}) {
  return db.shortLink.create({ data: input });
}

export async function findShortLinkBySlug(slug: string) {
  return db.shortLink.findUnique({ where: { slug } });
}

export async function incrementShortLinkClick(slug: string) {
  return db.shortLink.update({
    where: { slug },
    data: { clickCount: { increment: 1 } },
  });
}

export async function getSmsFunnelAdminMetrics() {
  const [sent, pending, failed, optOuts, linkClicks, consultations] =
    await Promise.all([
      db.smsMessage.count({ where: { status: "sent" } }),
      db.smsMessage.count({ where: { status: "pending" } }),
      db.smsMessage.count({ where: { status: "failed" } }),
      db.smsOptOut.count(),
      db.funnelEvent.count({ where: { type: "link_clicked" } }),
      db.funnelEvent.count({ where: { type: "consultation_started" } }),
    ]);

  return {
    smsSent: sent,
    smsPending: pending,
    smsFailed: failed,
    optOutCount: optOuts,
    linkClicks,
    consultationStarts: consultations,
  };
}

export async function listRecentSmsMessages(limit = 20) {
  return db.smsMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      phone: true,
      sequenceKey: true,
      stepKey: true,
      status: true,
      scheduledFor: true,
      sentAt: true,
      createdAt: true,
    },
  });
}

export async function listSmsOptOuts(limit = 50) {
  return db.smsOptOut.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
