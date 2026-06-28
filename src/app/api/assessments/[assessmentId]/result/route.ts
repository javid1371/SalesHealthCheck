import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import { getAssessmentResult } from "@/modules/assessment/assessment.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await params;
  const token = request.nextUrl.searchParams.get("token");

  return handleApiRequest(() => getAssessmentResult(assessmentId, token));
}
