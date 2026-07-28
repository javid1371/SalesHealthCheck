import type {
  AssessmentStatus,
  CallOutcome,
  HealthLevel,
  LostReason,
} from "@prisma/client";

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

export interface AdminFullFunnelStep {
  key: string;
  label: string;
  count: number;
  dropOffPercent: number | null;
}

export interface AdminDomainDropOffRow {
  domainIndex: number;
  domainSlug: string | null;
  count: number;
  dropOffPercent: number | null;
}

export interface AdminFullConversionFunnel {
  steps: AdminFullFunnelStep[];
  domainDropOff: AdminDomainDropOffRow[];
}

export interface AdminSmsFunnelMetrics {
  smsSent: number;
  smsPending: number;
  smsFailed: number;
  optOutCount: number;
  linkClicks: number;
  consultationStarts: number;
}

export interface AdminExpertPerformanceRow {
  staffUserId: string;
  name: string;
  assigned: number;
  closedWon: number;
  closedLost: number;
  open: number;
  contactedOpen: number;
  meetingScheduledOpen: number;
  winRate: number;
  overdueFollowUpOpen: number;
  newThisWeek: number;
  /** Call logs in the last 7 days */
  totalCalls: number;
  connectedInterestedRate: number;
  byOutcome: Record<CallOutcome, number>;
}

export interface AdminLostReasonBreakdownRow {
  reason: LostReason | null;
  reasonLabel: string;
  count: number;
}

export interface AdminLeadKpis {
  newThisWeek: number;
  pendingAssignment: number;
  overdueFollowUps: number;
  closeRate: number;
  highProbabilityUnassigned: number;
  staleNewLeads: number;
}

export interface AdminLeadStatusFunnel {
  assessmentInProgress: number;
  assessmentIncomplete: number;
  assessmentCompleted: number;
  new: number;
  contacted: number;
  meetingScheduled: number;
  closedWon: number;
  closedLost: number;
  unreachable: number;
}

export interface AdminLeadSourceBreakdown {
  direct: number;
  system: number;
  messenger: number;
}

export interface AdminLeadSourceConversionRow {
  source: "direct" | "system" | "messenger";
  sourceLabel: string;
  total: number;
  closedWon: number;
  conversionRate: number;
}

export interface AdminSalesMetrics {
  avgDaysToFirstContact: number | null;
  avgDaysToClose: number | null;
  sourceConversion: AdminLeadSourceConversionRow[];
}

export interface AdminDashboardData {
  kpis: AdminDashboardKpis;
  funnel: AdminDashboardFunnel;
  fullConversionFunnel: AdminFullConversionFunnel;
  leadKpis: AdminLeadKpis;
  leadStatusFunnel: AdminLeadStatusFunnel;
  leadSourceBreakdown: AdminLeadSourceBreakdown;
  salesMetrics: AdminSalesMetrics;
  expertPerformance: AdminExpertPerformanceRow[];
  lostReasonBreakdownLast30Days: AdminLostReasonBreakdownRow[];
  smsFunnel: AdminSmsFunnelMetrics;
}
