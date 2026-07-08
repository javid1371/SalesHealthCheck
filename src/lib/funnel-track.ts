import { apiPost } from "@/lib/api-client";

export const VISITOR_ID_STORAGE_KEY = "shc_vid";

export const FUNNEL_TRACK_EVENT_TYPES = [
  "landing_view",
  "assessment_start_click",
  "otp_sent",
  "phone_verified",
  "assessment_started",
  "domain_completed",
  "review_reached",
  "assessment_completed",
  "consultation_submitted",
] as const;

export type FunnelTrackEventType = (typeof FUNNEL_TRACK_EVENT_TYPES)[number];

function createVisitorId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `v-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") {
    return createVisitorId();
  }

  const existing = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const visitorId = createVisitorId();
  window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, visitorId);
  return visitorId;
}

export async function trackFunnelEvent(input: {
  type: FunnelTrackEventType;
  assessmentSessionId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await apiPost("/api/funnel/track", {
      type: input.type,
      assessmentSessionId: input.assessmentSessionId,
      metadata: {
        visitorId: getOrCreateVisitorId(),
        ...input.metadata,
      },
    });
  } catch {
    // Analytics must not block user flows.
  }
}
