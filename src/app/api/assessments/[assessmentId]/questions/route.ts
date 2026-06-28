import { handleApiRequest } from "@/lib/api-handler";
import { getAssessmentQuestions } from "@/modules/assessment/assessment.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await params;

  return handleApiRequest(() => getAssessmentQuestions(assessmentId));
}
