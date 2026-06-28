import { AppError } from "@/lib/errors";
import { findAssessmentById, findReportById } from "@/modules/assessment/assessment.repository";
import type {
  CreateConsultationRequestInput,
  CreateConsultationRequestResponse,
} from "@/modules/assessment/assessment.types";
import { createConsultationRequest } from "./consultation.repository";
import { validateConsultationRequest } from "./consultation.validators";

function verifyResultToken(
  token: string | undefined,
  expected: string,
): void {
  if (!token || token !== expected) {
    throw new AppError(
      "report_access_denied",
      "Invalid or missing access token",
      403,
    );
  }
}

export async function submitConsultationRequest(
  body: unknown,
): Promise<CreateConsultationRequestResponse> {
  const validated = validateConsultationRequest(body);

  if (validated.assessmentSessionId) {
    const assessment = await findAssessmentById(validated.assessmentSessionId);
    if (!assessment) {
      throw new AppError(
        "assessment_not_found",
        "Assessment not found",
        404,
      );
    }
    verifyResultToken(validated.token, assessment.resultToken);
  }

  if (validated.reportId) {
    const report = await findReportById(validated.reportId);
    if (!report) {
      throw new AppError("report_not_found", "Report not found", 404);
    }
    verifyResultToken(validated.token, report.assessmentSession.resultToken);
  }

  const { token: _token, ...input } = validated;

  const record = await createConsultationRequest(
    input satisfies CreateConsultationRequestInput,
  );

  return {
    id: record.id,
    createdAt: record.createdAt.toISOString(),
  };
}
