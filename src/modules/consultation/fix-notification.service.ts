import { db } from "@/lib/db";
import { createSmsSenderFromSettings } from "@/modules/auth/sms/kavenegar";
import { buildBrandedSmsMessage } from "@/modules/sms-funnel/branding";
import { createTrackedShortLink } from "@/modules/sms-funnel/short-link.service";

/**
 * One-off campaign: notify users who started the consultation form but
 * never completed it (blocked by the auth bug fixed in commit 734164d)
 * that the issue is resolved and they can now submit.
 */
const CAMPAIGN_TAG = "consultation_fix_notice_2026_07";

const MESSAGE_BODY =
  "سلام؛ مشکل فنی ثبت فرم درخواست مشاوره سلامت سیستم فروش برطرف شد. الان می‌تونید از لینک زیر ادامه بدید و مشاوره رایگانتون رو ثبت کنید:";

interface Candidate {
  assessmentSessionId: string;
  userId: string;
  phone: string;
  name: string | null;
  resultToken: string;
  reportId?: string;
}

async function findCandidates(): Promise<Candidate[]> {
  const sessions = await db.assessmentSession.findMany({
    where: {
      consultationRequests: { none: {} },
      funnelEvents: { some: { type: "consultation_started" } },
    },
    select: {
      id: true,
      userId: true,
      resultToken: true,
      user: { select: { phone: true, name: true } },
      report: { select: { id: true } },
      funnelEvents: {
        where: { type: "sms_sent" },
        select: { metadata: true },
      },
    },
  });

  const seenPhones = new Set<string>();
  const candidates: Candidate[] = [];

  for (const session of sessions) {
    const phone = session.user.phone;
    if (!phone) continue;

    const alreadyNotified = session.funnelEvents.some((event) => {
      const metadata = event.metadata as { campaign?: string } | null;
      return metadata?.campaign === CAMPAIGN_TAG;
    });
    if (alreadyNotified) continue;

    if (seenPhones.has(phone)) continue;
    seenPhones.add(phone);

    candidates.push({
      assessmentSessionId: session.id,
      userId: session.userId,
      phone,
      name: session.user.name,
      resultToken: session.resultToken,
      reportId: session.report?.id,
    });
  }

  return candidates;
}

export interface NotifyRecipient {
  phone: string;
  name: string | null;
}

export interface NotifyFailure extends NotifyRecipient {
  error: string;
}

export interface NotifyResult {
  total: number;
  sent: NotifyRecipient[];
  failed: NotifyFailure[];
  dryRun: boolean;
}

export async function notifyFailedConsultationUsers(
  options: { dryRun?: boolean } = {},
): Promise<NotifyResult> {
  const candidates = await findCandidates();
  const dryRun = options.dryRun ?? false;

  const result: NotifyResult = {
    total: candidates.length,
    sent: [],
    failed: [],
    dryRun,
  };

  if (dryRun) {
    result.sent = candidates.map((c) => ({ phone: c.phone, name: c.name }));
    return result;
  }

  const sender = await createSmsSenderFromSettings();

  for (const candidate of candidates) {
    try {
      const link = await createTrackedShortLink({
        purpose: "consultation",
        userId: candidate.userId,
        assessmentSessionId: candidate.assessmentSessionId,
        resultToken: candidate.resultToken,
        reportId: candidate.reportId,
      });

      const message = buildBrandedSmsMessage(MESSAGE_BODY, link);
      const sendResult = await sender.sendMessage(candidate.phone, message);

      await db.funnelEvent.create({
        data: {
          userId: candidate.userId,
          assessmentSessionId: candidate.assessmentSessionId,
          type: "sms_sent",
          metadata: {
            campaign: CAMPAIGN_TAG,
            providerMessageId: sendResult.providerMessageId ?? null,
          },
        },
      });

      result.sent.push({ phone: candidate.phone, name: candidate.name });
    } catch (error) {
      result.failed.push({
        phone: candidate.phone,
        name: candidate.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
