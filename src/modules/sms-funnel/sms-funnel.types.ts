export const SMS_FUNNEL_QUEUE_NAME = "sms-funnel";

export interface SmsFunnelJobPayload {
  enrollmentId: string;
  sequenceKey: string;
  stepKey: string;
  dedupeKey: string;
  smsMessageId: string;
}

export function buildDedupeKey(
  enrollmentId: string,
  stepKey: string,
): string {
  return `${enrollmentId}:${stepKey}`;
}
