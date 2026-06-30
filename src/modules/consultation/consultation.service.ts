import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { verifyConfiguredPassword } from "@/lib/password-auth";
import { findAssessmentById, findReportById } from "@/modules/assessment/assessment.repository";
import type {
  CreateConsultationRequestInput,
  CreateConsultationRequestResponse,
} from "@/modules/assessment/assessment.types";
import {
  countConsultationRequests,
  createConsultationRequest,
  findConsultationRequests,
} from "./consultation.repository";
import type {
  ConsultationListFilter,
  ConsultationListItem,
  ConsultationListResponse,
  ConsultationsAccessInput,
} from "./consultation.types";
import { validateConsultationRequest } from "./consultation.validators";
import { validateSalesExpertLoginRequest } from "./consultation-list.validators";

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

function formatConsultationDate(date: Date): string {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isSalesExpertPasswordValid(password: string): boolean {
  return verifyConfiguredPassword(password, {
    plain: env.salesExpertPassword,
    hash: env.salesExpertPasswordHash,
  });
}

export function hasConsultationsAccess(
  access: ConsultationsAccessInput,
): boolean {
  return Boolean(access.adminSession || access.salesExpertSession);
}

export function requireConsultationsAccess(
  access: ConsultationsAccessInput,
): void {
  if (!hasConsultationsAccess(access)) {
    throw new AppError(
      "UNAUTHORIZED",
      "برای مشاهده درخواست‌های مشاوره ابتدا وارد شوید.",
      401,
    );
  }
}

export function verifySalesExpertPassword(body: unknown): void {
  const { password } = validateSalesExpertLoginRequest(body);

  if (!env.salesExpertPassword && !env.salesExpertPasswordHash) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Sales expert login is not configured",
      500,
    );
  }

  if (!isSalesExpertPasswordValid(password)) {
    throw new AppError("UNAUTHORIZED", "رمز عبور نادرست است.", 401);
  }
}

function toConsultationListItem(
  row: Awaited<ReturnType<typeof findConsultationRequests>>[number],
): ConsultationListItem {
  const assessmentId = row.assessmentSessionId;
  const reportId = row.reportId;

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    message: row.message,
    createdAt: formatConsultationDate(row.createdAt),
    businessName: row.assessmentSession?.organization.businessName ?? null,
    assessmentUserPhone: row.assessmentSession?.user.phone ?? null,
    overallScorePercentage: row.assessmentSession?.overallScore
      ? Math.round(row.assessmentSession.overallScore.percentage)
      : null,
    assessmentId,
    reportId,
    resultUrl: assessmentId ? `/assessment/${assessmentId}/result` : null,
    reportUrl:
      reportId && assessmentId
        ? `/report/${reportId}?assessmentId=${assessmentId}`
        : null,
    expertViewUrl: assessmentId ? `/expert/${assessmentId}` : null,
    adminAssessmentUrl: assessmentId
      ? `/admin/assessments/${assessmentId}`
      : null,
  };
}

export async function listConsultationRequests(
  filter: ConsultationListFilter,
): Promise<ConsultationListResponse> {
  const [total, requests] = await Promise.all([
    countConsultationRequests(filter),
    findConsultationRequests(filter),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / filter.pageSize);

  return {
    requests: requests.map(toConsultationListItem),
    pagination: {
      page: filter.page,
      pageSize: filter.pageSize,
      total,
      totalPages,
    },
  };
}
