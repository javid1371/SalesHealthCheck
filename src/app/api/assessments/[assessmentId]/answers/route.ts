import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import { readAssessmentAccess } from "@/modules/assessment/assessment-access";
import {
  getAssessmentAnswers,
  saveAnswers,
} from "@/modules/assessment/assessment.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await params;
  const access = readAssessmentAccess(request);

  return handleApiRequest(() => getAssessmentAnswers(assessmentId, access));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await params;
  const access = readAssessmentAccess(request);
  const body = await request.json();

  return handleApiRequest(() => saveAnswers(assessmentId, body, access));
}
