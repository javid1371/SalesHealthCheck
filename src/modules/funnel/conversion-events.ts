import type { FunnelEventType, Prisma } from "@prisma/client";
import { createFunnelEvent } from "@/modules/sms-funnel/funnel.repository";

export function recordConversionFunnelEvent(input: {
  userId?: string;
  assessmentSessionId?: string;
  type: FunnelEventType;
  metadata?: Prisma.InputJsonValue;
}): void {
  void createFunnelEvent(input).catch((error) => {
    console.error("[funnel] failed to record conversion event:", error);
  });
}
