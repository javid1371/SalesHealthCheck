import type { AssessmentStatus } from "@prisma/client";
import { healthLevelLabelFa } from "@/lib/health-level";
import { findAssessmentsByUserId } from "./account.repository";
import type { MyAssessmentListItem, MyAssessmentsResponse } from "./account.types";

const STATUS_LABELS: Record<AssessmentStatus, string> = {
  started: "شروع شده",
  in_progress: "در حال انجام",
  completed: "تکمیل شده",
  abandoned: "رها شده",
};

function formatAssessmentDate(date: Date): string {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function buildAction(assessmentId: string, status: AssessmentStatus) {
  if (status === "completed") {
    return {
      actionUrl: `/assessment/${assessmentId}/result`,
      actionLabel: "مشاهده نتیجه",
    };
  }

  return {
    actionUrl: `/assessment/${assessmentId}/review`,
    actionLabel: "ادامه تست",
  };
}

function toListItem(
  assessment: Awaited<ReturnType<typeof findAssessmentsByUserId>>[number],
): MyAssessmentListItem {
  const { actionUrl, actionLabel } = buildAction(
    assessment.id,
    assessment.status,
  );

  return {
    assessmentId: assessment.id,
    businessName: assessment.organization.businessName,
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
    actionUrl,
    actionLabel,
  };
}

export async function listMyAssessments(
  userId: string,
): Promise<MyAssessmentsResponse> {
  const assessments = await findAssessmentsByUserId(userId);

  return {
    assessments: assessments.map(toListItem),
  };
}

export function overallScoreLabel(
  item: MyAssessmentListItem,
): string | null {
  if (!item.overallScore) {
    return null;
  }

  return `${item.overallScore.percentage}٪ — ${healthLevelLabelFa(item.overallScore.healthLevel)}`;
}
