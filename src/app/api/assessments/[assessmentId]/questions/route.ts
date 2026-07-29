import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import { readAssessmentAccess } from "@/modules/assessment/assessment-access";
import { getAssessmentQuestions } from "@/modules/assessment/assessment.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await params;
  const access = readAssessmentAccess(request);

  return handleApiRequest(() => getAssessmentQuestions(assessmentId, access));
}
