import { handleApiRequest } from "@/lib/api-handler";
import { updateBusinessMetrics } from "@/modules/assessment/assessment.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await params;
  const body = await request.json();

  return handleApiRequest(() => updateBusinessMetrics(assessmentId, body));
}
