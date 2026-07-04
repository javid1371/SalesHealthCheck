import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import { getClientIp } from "@/lib/request-ip";
import {
  consultationRequestLimiter,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { readSessionsFromRequest } from "@/lib/session";
import { submitConsultationRequest } from "@/modules/consultation/consultation.service";

export async function POST(request: NextRequest) {
  const { allowed, retryAfterSec } = consultationRequestLimiter(
    getClientIp(request),
  );

  if (!allowed) {
    return rateLimitResponse(retryAfterSec);
  }

  const body = await request.json();
  const { userSession, adminSession, salesExpertSession } =
    readSessionsFromRequest(request);

  return handleApiRequest(() =>
    submitConsultationRequest(body, {
      userSession,
      adminSession,
      salesExpertSession,
    }),
  );
}
