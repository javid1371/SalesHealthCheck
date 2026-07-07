export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INTERNAL_ERROR"
  | "ASSESSMENT_INCOMPLETE"
  | "INVALID_OPTION"
  | "invalid_user_data"
  | "invalid_organization_data"
  | "invalid_business_info"
  | "invalid_business_metrics"
  | "invalid_answer_payload"
  | "active_model_version_not_found"
  | "assessment_not_found"
  | "assessment_not_complete"
  | "assessment_not_completed"
  | "assessment_already_completed"
  | "assessment_access_denied"
  | "questions_not_found"
  | "question_not_found"
  | "option_not_found"
  | "option_does_not_belong_to_question"
  | "question_does_not_belong_to_model_version"
  | "report_not_found"
  | "report_access_denied"
  | "assessment_start_failed"
  | "scoring_failed"
  | "diagnosis_failed"
  | "report_generation_failed"
  | "pdf_generation_disabled"
  | "pdf_generation_failed"
  | "chart_not_found"
  | "chart_generation_failed"
  | "report_spec_unavailable"
  | "funnel_not_found"
  | "funnel_access_denied";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    code: AppErrorCode,
    message: string,
    status: number,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function errorResponse(error: AppError) {
  return Response.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    },
    { status: error.status },
  );
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
