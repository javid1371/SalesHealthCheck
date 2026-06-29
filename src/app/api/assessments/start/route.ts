import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import { AppError } from "@/lib/errors";
import { getClientIp } from "@/lib/request-ip";
import { rateLimitResponse, startAssessmentLimiter } from "@/lib/rate-limit";
import { parseUserSessionCookie, USER_SESSION_COOKIE } from "@/lib/session";
import { startAssessment } from "@/modules/assessment/assessment.service";

export async function POST(request: NextRequest) {
  const { allowed, retryAfterSec } = startAssessmentLimiter(
    getClientIp(request),
  );

  if (!allowed) {
    return rateLimitResponse(retryAfterSec);
  }

  const body = await request.json();
  return handleApiRequest(async () => {
    const session = parseUserSessionCookie(
      request.cookies.get(USER_SESSION_COOKIE)?.value,
    );
    if (!session) {
      throw new AppError(
        "UNAUTHORIZED",
        "برای شروع ارزیابی ابتدا وارد شوید.",
        401,
      );
    }

    return startAssessment(body, { userId: session.userId });
  });
}
