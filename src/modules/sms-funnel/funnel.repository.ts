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

export async function findActiveCallScheduledEnrollment(input: {
  userId: string;
  assessmentSessionId?: string | null;
}) {
  return db.funnelEnrollment.findFirst({
    where: {
      userId: input.userId,
      sequenceKey: "seq_call_scheduled",
      status: "active",
      assessmentSessionId: input.assessmentSessionId ?? null,
    },
    select: { id: true },
  });
}

export async function listPendingSmsForEnrollment(enrollmentId: string) {
  return db.smsMessage.findMany({
    where: {
      enrollmentId,
      status: "pending",
    },
    select: {
      id: true,
      stepKey: true,
      dedupeKey: true,
      enrollmentId: true,
      sequenceKey: true,
      scheduledFor: true,
    },
  });
}

export async function updateSmsMessageScheduledFor(
  id: string,
  scheduledFor: Date,
) {
  return db.smsMessage.updateMany({
    where: { id, status: "pending" },
    data: { scheduledFor },
  });
}

export async function cancelPendingSmsMessage(
  id: string,
  error: string,
) {
  return db.smsMessage.updateMany({
    where: { id, status: "pending" },
    data: {
      status: "canceled",
      error,
    },
  });
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

const leadSmsMessageSelect = {
  id: true,
  phone: true,
  sequenceKey: true,
  stepKey: true,
  status: true,
  scheduledFor: true,
  sentAt: true,
  createdAt: true,
  error: true,
} as const;

const leadEnrollmentSelect = {
  id: true,
  sequenceKey: true,
  currentStep: true,
  status: true,
  messagesSentCount: true,
  lastEventAt: true,
} as const;

/**
 * Lead SMS history: messages matching lead phone and/or assessment user phone,
 * plus messages linked via enrollment when assessmentSessionId is present.
 * Active enrollments for the same scope are returned for the detail panel.
 */
export async function listLeadSmsHistory(input: {
  phones: string[];
  assessmentSessionId?: string | null;
  limit?: number;
}) {
  const phones = [...new Set(input.phones.map((p) => p.trim()).filter(Boolean))];
  const assessmentSessionId = input.assessmentSessionId ?? null;
  const limit = input.limit ?? 50;

  const messageOr: Prisma.SmsMessageWhereInput[] = [];
  if (phones.length > 0) {
    messageOr.push({ phone: { in: phones } });
  }
  if (assessmentSessionId) {
    messageOr.push({
      enrollment: { assessmentSessionId },
    });
  }

  const enrollmentOr: Prisma.FunnelEnrollmentWhereInput[] = [];
  if (assessmentSessionId) {
    enrollmentOr.push({ assessmentSessionId });
  }
  if (phones.length > 0) {
    enrollmentOr.push({
      smsMessages: { some: { phone: { in: phones } } },
    });
  }

  if (messageOr.length === 0 && enrollmentOr.length === 0) {
    return { messages: [], activeEnrollments: [] };
  }

  const [messages, activeEnrollments] = await Promise.all([
    messageOr.length === 0
      ? Promise.resolve([])
      : db.smsMessage.findMany({
          where: { OR: messageOr },
          orderBy: [{ createdAt: "desc" }, { scheduledFor: "desc" }],
          take: limit,
          select: leadSmsMessageSelect,
        }),
    enrollmentOr.length === 0
      ? Promise.resolve([])
      : db.funnelEnrollment.findMany({
          where: {
            status: "active",
            OR: enrollmentOr,
          },
          orderBy: { lastEventAt: "desc" },
          select: leadEnrollmentSelect,
        }),
  ]);

  return { messages, activeEnrollments };
}

export async function listSmsOptOuts(limit = 50) {
  return db.smsOptOut.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

const FULL_FUNNEL_STEP_TYPES: FunnelEventType[] = [
  "landing_view",
  "assessment_start_click",
  "otp_sent",
  "phone_verified",
  "assessment_started",
  "review_reached",
  "assessment_completed",
  "report_viewed",
  "consultation_started",
  "consultation_submitted",
];

const FULL_FUNNEL_STEP_LABELS: Record<FunnelEventType, string> = {
  landing_view: "بازدید فرود",
  assessment_start_click: "کلیک شروع ارزیابی",
  otp_sent: "ارسال OTP",
  phone_verified: "تأیید تلفن",
  assessment_started: "شروع ارزیابی",
  domain_completed: "تکمیل دامنه",
  review_reached: "رسیدن به مرور",
  assessment_completed: "تکمیل ارزیابی",
  report_viewed: "مشاهده گزارش",
  consultation_started: "شروع فرم مشاوره",
  consultation_submitted: "ثبت درخواست مشاوره",
  link_clicked: "کلیک لینک",
  cta_clicked: "کلیک CTA",
  sms_sent: "ارسال پیامک",
  opt_out: "لغو پیامک",
};

export interface FullConversionFunnelStep {
  key: FunnelEventType;
  label: string;
  count: number;
  dropOffPercent: number | null;
}

export interface DomainDropOffRow {
  domainIndex: number;
  domainSlug: string | null;
  count: number;
  dropOffPercent: number | null;
}

export interface FullConversionFunnelMetrics {
  steps: FullConversionFunnelStep[];
  domainDropOff: DomainDropOffRow[];
}

function resolveFunnelActorKey(event: {
  userId: string | null;
  assessmentSessionId: string | null;
  metadata: unknown;
}): string | null {
  if (event.userId) {
    return `u:${event.userId}`;
  }

  if (event.metadata && typeof event.metadata === "object" && event.metadata !== null) {
    const visitorId = (event.metadata as Record<string, unknown>).visitorId;
    if (typeof visitorId === "string" && visitorId.trim()) {
      return `v:${visitorId}`;
    }
  }

  if (event.assessmentSessionId) {
    return `a:${event.assessmentSessionId}`;
  }

  return null;
}

function countDistinctActors(
  events: Array<{
    userId: string | null;
    assessmentSessionId: string | null;
    metadata: unknown;
  }>,
): number {
  const actors = new Set<string>();

  for (const event of events) {
    const key = resolveFunnelActorKey(event);
    if (key) {
      actors.add(key);
    }
  }

  return actors.size;
}

function dropOffPercent(previous: number, current: number): number | null {
  if (previous <= 0) {
    return null;
  }
  return Math.round(((previous - current) / previous) * 100);
}

const FULL_FUNNEL_QUERY_TYPES: FunnelEventType[] = [
  ...FULL_FUNNEL_STEP_TYPES,
  "domain_completed",
];

export async function getFullConversionFunnelMetrics(): Promise<FullConversionFunnelMetrics> {
  const events = await db.funnelEvent.findMany({
    where: {
      type: {
        in: FULL_FUNNEL_QUERY_TYPES,
      },
    },
    select: {
      type: true,
      userId: true,
      assessmentSessionId: true,
      metadata: true,
    },
  });

  const eventsByType = new Map<FunnelEventType, typeof events>();
  for (const type of FULL_FUNNEL_QUERY_TYPES) {
    eventsByType.set(
      type,
      events.filter((event) => event.type === type),
    );
  }

  const steps: FullConversionFunnelStep[] = [];
  let previousCount = 0;

  for (const type of FULL_FUNNEL_STEP_TYPES) {
    const typeEvents = eventsByType.get(type) ?? [];
    const count = countDistinctActors(typeEvents);
    steps.push({
      key: type,
      label: FULL_FUNNEL_STEP_LABELS[type],
      count,
      dropOffPercent:
        steps.length === 0 ? null : dropOffPercent(previousCount, count),
    });
    previousCount = count;
  }

  const domainEvents = eventsByType.get("domain_completed") ?? [];
  const domainMap = new Map<
    number,
    {
      slug: string | null;
      actors: Set<string>;
    }
  >();

  for (const event of domainEvents) {
    const actor = resolveFunnelActorKey(event);
    if (!actor) {
      continue;
    }

    const metadata =
      event.metadata && typeof event.metadata === "object"
        ? (event.metadata as Record<string, unknown>)
        : null;
    const domainIndex = metadata?.domainIndex;
    if (typeof domainIndex !== "number" || domainIndex < 0) {
      continue;
    }

    const domainSlug =
      typeof metadata?.domainSlug === "string" ? metadata.domainSlug : null;
    const entry = domainMap.get(domainIndex) ?? {
      slug: domainSlug,
      actors: new Set<string>(),
    };
    if (!entry.slug && domainSlug) {
      entry.slug = domainSlug;
    }
    entry.actors.add(actor);
    domainMap.set(domainIndex, entry);
  }

  const sortedDomains = [...domainMap.entries()].sort(
    ([left], [right]) => left - right,
  );

  const assessmentStartedCount = countDistinctActors(
    eventsByType.get("assessment_started") ?? [],
  );

  const domainDropOff: DomainDropOffRow[] = sortedDomains.map(
    ([domainIndex, entry], index) => {
      const count = entry.actors.size;
      const baseline =
        index === 0
          ? assessmentStartedCount
          : (sortedDomains[index - 1]?.[1].actors.size ?? 0);

      return {
        domainIndex,
        domainSlug: entry.slug,
        count,
        dropOffPercent: dropOffPercent(baseline, count),
      };
    },
  );

  return { steps, domainDropOff };
}
