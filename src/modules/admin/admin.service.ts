import { scryptSync, timingSafeEqual } from "node:crypto";
import type { AssessmentStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import type { AdminSession } from "@/lib/session";
import {
  countAssessmentsForAdmin,
  findAssessmentForAdmin,
  findAssessmentsForAdmin,
} from "./admin.repository";
import { healthLevelLabelFa } from "@/lib/health-level";
import type {
  AdminAssessmentDetail,
  AdminAssessmentFilter,
  AdminAssessmentListItem,
  AdminAssessmentsResponse,
} from "./admin.types";
import { validateAdminLoginRequest } from "./admin.validators";

const STATUS_LABELS: Record<AssessmentStatus, string> = {
  started: "شروع شده",
  in_progress: "در حال انجام",
  completed: "تکمیل شده",
  abandoned: "رها شده",
};

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

function verifyScryptPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }

  const salt = Buffer.from(parts[1], "base64");
  const expectedHash = Buffer.from(parts[2], "base64");
  if (salt.length === 0 || expectedHash.length === 0) {
    return false;
  }

  const derived = scryptSync(password, salt, expectedHash.length);
  return timingSafeEqual(derived, expectedHash);
}

function isAdminPasswordValid(password: string): boolean {
  const hash = env.adminPasswordHash;
  if (hash) {
    return verifyScryptPassword(password, hash);
  }

  const plain = env.adminPassword;
  if (plain) {
    return timingSafeStringEqual(password, plain);
  }

  return false;
}

function formatAssessmentDate(date: Date): string {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toListItem(
  assessment: Awaited<ReturnType<typeof findAssessmentsForAdmin>>[number],
): AdminAssessmentListItem {
  return {
    assessmentId: assessment.id,
    businessName: assessment.organization.businessName,
    userName: assessment.user.name,
    phone: assessment.user.phone,
    status: assessment.status,
    statusLabel: STATUS_LABELS[assessment.status],
    startedAt: formatAssessmentDate(assessment.startedAt),
    completedAt: assessment.completedAt
      ? formatAssessmentDate(assessment.completedAt)
      : null,
    overallScore: assessment.overallScore
      ? {
          percentage: Math.round(assessment.overallScore.percentage),
          healthLevel: assessment.overallScore.healthLevel,
        }
      : null,
    detailUrl: `/admin/assessments/${assessment.id}`,
  };
}

export function requireAdminSession(
  session: AdminSession | null,
): asserts session is AdminSession {
  if (!session) {
    throw new AppError(
      "UNAUTHORIZED",
      "برای دسترسی به پنل ادمین ابتدا وارد شوید.",
      401,
    );
  }
}

export function verifyAdminPassword(body: unknown): void {
  const { password } = validateAdminLoginRequest(body);

  if (!env.adminPassword && !env.adminPasswordHash) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Admin login is not configured",
      500,
    );
  }

  if (!isAdminPasswordValid(password)) {
    throw new AppError("UNAUTHORIZED", "رمز عبور نادرست است.", 401);
  }
}

export async function listAssessments(
  filter: AdminAssessmentFilter,
): Promise<AdminAssessmentsResponse> {
  const [total, assessments] = await Promise.all([
    countAssessmentsForAdmin(filter),
    findAssessmentsForAdmin(filter),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / filter.pageSize);

  return {
    assessments: assessments.map(toListItem),
    pagination: {
      page: filter.page,
      pageSize: filter.pageSize,
      total,
      totalPages,
    },
  };
}

export function overallScoreLabel(item: AdminAssessmentListItem): string | null {
  if (!item.overallScore) {
    return null;
  }

  return `${item.overallScore.percentage}٪ — ${healthLevelLabelFa(item.overallScore.healthLevel)}`;
}

export async function getAssessmentForAdmin(
  assessmentId: string,
): Promise<AdminAssessmentDetail> {
  const assessment = await findAssessmentForAdmin(assessmentId);

  if (!assessment) {
    throw new AppError(
      "assessment_not_found",
      "Assessment not found",
      404,
      { assessmentId },
    );
  }

  const reportId = assessment.report?.id ?? null;

  return {
    assessmentId: assessment.id,
    status: assessment.status,
    statusLabel: STATUS_LABELS[assessment.status],
    businessName: assessment.organization.businessName,
    userName: assessment.user.name,
    phone: assessment.user.phone,
    email: assessment.user.email,
    startedAt: formatAssessmentDate(assessment.startedAt),
    completedAt: assessment.completedAt
      ? formatAssessmentDate(assessment.completedAt)
      : null,
    reportId,
    overallScore: assessment.overallScore
      ? {
          percentage: Math.round(assessment.overallScore.percentage),
          healthLevel: assessment.overallScore.healthLevel,
        }
      : null,
    expertViewUrl: `/expert/${assessment.id}`,
    resultUrl:
      assessment.status === "completed"
        ? `/assessment/${assessment.id}/result`
        : null,
    reportUrl:
      reportId && assessment.status === "completed"
        ? `/report/${reportId}?assessmentId=${assessment.id}`
        : null,
  };
}
