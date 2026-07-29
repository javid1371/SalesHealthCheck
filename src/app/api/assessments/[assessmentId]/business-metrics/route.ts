import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import { readAssessmentAccess } from "@/modules/assessment/assessment-access";
import { updateBusinessMetrics } from "@/modules/assessment/assessment.service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await params;
  const access = readAssessmentAccess(request);
  const body = await request.json();

  return handleApiRequest(() =>
    updateBusinessMetrics(assessmentId, body, access),
  );
}
