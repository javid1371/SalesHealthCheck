import type { NextRequest } from "next/server";
import type { FunnelEventType, Prisma } from "@prisma/client";
import { handleApiRequest } from "@/lib/api-handler";
import { AppError } from "@/lib/errors";
import { FUNNEL_TRACK_EVENT_TYPES } from "@/lib/funnel-track";
import { getClientIp } from "@/lib/request-ip";
import { funnelTrackLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { parseUserSessionCookie, USER_SESSION_COOKIE } from "@/lib/session";
import { createFunnelEvent } from "@/modules/sms-funnel/funnel.repository";

const TRACKABLE_TYPES = new Set<FunnelEventType>(FUNNEL_TRACK_EVENT_TYPES);

type TrackBody = {
  type: FunnelEventType;
  assessmentSessionId?: string;
  metadata?: Prisma.InputJsonValue;
};

function validateBody(body: unknown): TrackBody {
  if (!body || typeof body !== "object") {
    throw new AppError("VALIDATION_ERROR", "Invalid request body", 400);
  }

  const record = body as Record<string, unknown>;
  const type = record.type;

  if (typeof type !== "string" || !TRACKABLE_TYPES.has(type as FunnelEventType)) {
    throw new AppError("VALIDATION_ERROR", "Invalid event type", 400);
  }

  const assessmentSessionId = record.assessmentSessionId;
  if (
    assessmentSessionId !== undefined &&
    (typeof assessmentSessionId !== "string" || !assessmentSessionId)
  ) {
    throw new AppError("VALIDATION_ERROR", "Invalid assessmentSessionId", 400);
  }

  let metadata: Prisma.InputJsonValue | undefined;
  if (record.metadata !== undefined) {
    if (!record.metadata || typeof record.metadata !== "object") {
      throw new AppError("VALIDATION_ERROR", "Invalid metadata", 400);
    }
    metadata = record.metadata as Prisma.InputJsonValue;
    const visitorId = (record.metadata as Record<string, unknown>).visitorId;
    if (typeof visitorId !== "string" || !visitorId.trim()) {
      throw new AppError("VALIDATION_ERROR", "visitorId is required in metadata", 400);
    }
  } else {
    throw new AppError("VALIDATION_ERROR", "metadata with visitorId is required", 400);
  }

  return {
    type: type as FunnelEventType,
    assessmentSessionId:
      typeof assessmentSessionId === "string" ? assessmentSessionId : undefined,
    metadata,
  };
}

export async function POST(request: NextRequest) {
  const { allowed, retryAfterSec } = await funnelTrackLimiter(
    getClientIp(request),
  );

  if (!allowed) {
    return rateLimitResponse(retryAfterSec);
  }

  const body = validateBody(await request.json());
  const userSession = parseUserSessionCookie(
    request.cookies.get(USER_SESSION_COOKIE)?.value,
  );

  return handleApiRequest(async () => {
    await createFunnelEvent({
      userId: userSession?.userId,
      assessmentSessionId: body.assessmentSessionId,
      type: body.type,
      metadata: body.metadata,
    });

    return { ok: true };
  });
}
