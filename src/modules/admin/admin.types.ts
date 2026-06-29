import type { AssessmentStatus, HealthLevel } from "@prisma/client";

export interface AdminLoginInput {
  password: string;
}

export interface AdminAssessmentFilter {
  phone?: string;
  businessName?: string;
  status?: AssessmentStatus;
  startedFrom?: Date;
  startedTo?: Date;
  page: number;
  pageSize: number;
}

export interface AdminAssessmentListItem {
  assessmentId: string;
  businessName: string;
  userName: string | null;
  phone: string | null;
  status: AssessmentStatus;
  statusLabel: string;
  startedAt: string;
  completedAt: string | null;
  overallScore: {
    percentage: number;
    healthLevel: HealthLevel;
  } | null;
  detailUrl: string;
}

export interface AdminAssessmentsResponse {
  assessments: AdminAssessmentListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminAssessmentDetail {
  assessmentId: string;
  status: AssessmentStatus;
  statusLabel: string;
  businessName: string;
  userName: string | null;
  phone: string | null;
  email: string | null;
  startedAt: string;
  completedAt: string | null;
  reportId: string | null;
  overallScore: {
    percentage: number;
    healthLevel: HealthLevel;
  } | null;
  expertViewUrl: string;
  resultUrl: string | null;
  reportUrl: string | null;
}
