import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import { env } from "@/lib/env";
import { finishEnqueueLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { readAssessmentAccess } from "@/modules/assessment/assessment-access";
import {
  enqueueFinishAssessment,
  finishAssessment,
  getFinishJobStatus,
} from "@/modules/assessment/assessment.service";
import type { EnqueueFinishAssessmentResult } from "@/modules/assessment/assessment.types";
import { validateFinishRequest } from "@/modules/assessment/assessment.validators";

function isQueuedFinishResult(
  result: EnqueueFinishAssessmentResult,
): result is Extract<EnqueueFinishAssessmentResult, { status: "queued" }> {
  return result.status === "queued" && "jobId" in result;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await params;
  const access = readAssessmentAccess(request);

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const input = validateFinishRequest(body);

  if (env.asyncFinishEnabled) {
    const { allowed, retryAfterSec } =
      await finishEnqueueLimiter(assessmentId);
    if (!allowed) {
      return rateLimitResponse(retryAfterSec);
    }

    return handleApiRequest(
      () => enqueueFinishAssessment(assessmentId, access, input),
      {
        statusFor: (result) => (isQueuedFinishResult(result) ? 202 : 200),
      },
    );
  }

  return handleApiRequest(() => finishAssessment(assessmentId, input, access));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await params;
  const access = readAssessmentAccess(request);

  return handleApiRequest(() => getFinishJobStatus(assessmentId, access));
}
