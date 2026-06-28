import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import { getClientIp } from "@/lib/request-ip";
import { rateLimitResponse, startAssessmentLimiter } from "@/lib/rate-limit";
import { startAssessment } from "@/modules/assessment/assessment.service";

export async function POST(request: NextRequest) {
  const { allowed, retryAfterSec } = startAssessmentLimiter(
    getClientIp(request),
  );

  if (!allowed) {
    return rateLimitResponse(retryAfterSec);
  }

  const body = await request.json();
  return handleApiRequest(() => startAssessment(body));
}
