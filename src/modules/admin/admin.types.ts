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

export interface AdminDashboardKpis {
  usersStartedThisWeek: number;
  usersCompletedThisWeek: number;
  userCompletionRate: number;
  usersVerifiedThisWeek: number;
  usersCriticalLeads: number;
  usersNewConsultations: number;
  /** Session-level counts for operational visibility */
  assessmentsThisWeek: number;
  assessmentsThisMonth: number;
}

export interface AdminDashboardFunnel {
  started: number;
  completed: number;
  consultations: number;
  completedRate: number;
  consultationRate: number;
}

export interface AdminSmsFunnelMetrics {
  smsSent: number;
  smsPending: number;
  smsFailed: number;
  optOutCount: number;
  linkClicks: number;
  consultationStarts: number;
}

export interface AdminSmsMessageRow {
  id: string;
  phone: string;
  sequenceKey: string;
  stepKey: string;
  status: string;
  scheduledFor: string;
  sentAt: string | null;
  createdAt: string;
}

export interface AdminExpertPerformanceRow {
  staffUserId: string;
  name: string;
  assigned: number;
  closedWon: number;
  closedLost: number;
  open: number;
}

export interface AdminDashboardData {
  kpis: AdminDashboardKpis;
  funnel: AdminDashboardFunnel;
  expertPerformance: AdminExpertPerformanceRow[];
  smsFunnel: AdminSmsFunnelMetrics;
  recentSmsMessages: AdminSmsMessageRow[];
}
