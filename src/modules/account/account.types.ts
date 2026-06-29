import type { AssessmentStatus, HealthLevel } from "@prisma/client";

export interface MyAssessmentListItem {
  assessmentId: string;
  businessName: string;
  status: AssessmentStatus;
  statusLabel: string;
  startedAt: string;
  completedAt: string | null;
  overallScore: {
    percentage: number;
    healthLevel: HealthLevel;
  } | null;
  actionUrl: string;
  actionLabel: string;
}

export interface MyAssessmentsResponse {
  assessments: MyAssessmentListItem[];
}
