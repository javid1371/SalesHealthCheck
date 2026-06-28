import { handleApiRequest } from "@/lib/api-handler";
import { finishAssessment } from "@/modules/assessment/assessment.service";
import { validateFinishRequest } from "@/modules/assessment/assessment.validators";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await params;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const input = validateFinishRequest(body);

  return handleApiRequest(() => finishAssessment(assessmentId, input));
}
