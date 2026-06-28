import { handleApiRequest } from "@/lib/api-handler";
import {
  getAssessmentAnswers,
  saveAnswers,
} from "@/modules/assessment/assessment.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await params;

  return handleApiRequest(() => getAssessmentAnswers(assessmentId));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await params;
  const body = await request.json();

  return handleApiRequest(() => saveAnswers(assessmentId, body));
}
