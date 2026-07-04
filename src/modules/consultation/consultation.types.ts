import type { AdminSession, SalesExpertSession } from "@/lib/session";
import type { LeadSource, LeadStatus, PurchaseProbability } from "@prisma/client";

export interface ConsultationListFilter {
  phone?: string;
  businessName?: string;
  createdFrom?: Date;
  createdTo?: Date;
  status?: LeadStatus;
  assignedToId?: string;
  onlyUnassigned?: boolean;
  onlyMine?: boolean;
  page: number;
  pageSize: number;
}

export interface ConsultationListItem {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  message: string | null;
  status: LeadStatus;
  statusLabel: string;
  source: LeadSource;
  sourceLabel: string;
  purchaseProbabilityPercent: number | null;
  purchaseProbabilityLabel: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  nextFollowUpAt: string | null;
  nextFollowUpAtIso: string | null;
  createdAt: string;
  businessName: string | null;
  assessmentUserPhone: string | null;
  overallScorePercentage: number | null;
  assessmentId: string | null;
  reportId: string | null;
  resultUrl: string | null;
  reportUrl: string | null;
  expertViewUrl: string | null;
  adminAssessmentUrl: string | null;
  detailUrl: string;
}

export interface ConsultationListResponse {
  requests: ConsultationListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface SalesExpertLoginInput {
  password: string;
}

export type ConsultationsAccessInput = {
  adminSession?: AdminSession | null;
  salesExpertSession?: SalesExpertSession | null;
};

export interface ConsultationNoteItem {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
}

export interface ExpertDashboardFollowUpRow {
  id: string;
  name: string;
  businessName: string | null;
  statusLabel: string;
  nextFollowUpAt: string | null;
  detailUrl: string;
}

export interface ExpertDashboardData {
  kpis: {
    assignedTotal: number;
    newLeads: number;
    followUpDue: number;
    closedThisMonth: number;
  };
  todayFollowUps: ExpertDashboardFollowUpRow[];
}

export interface ConsultationLeadDetail {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  message: string | null;
  status: LeadStatus;
  statusLabel: string;
  source: LeadSource;
  sourceLabel: string;
  purchaseProbabilityPercent: number | null;
  purchaseProbabilityLabel: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  nextFollowUpAt: string | null;
  nextFollowUpAtIso: string | null;
  createdAt: string;
  businessName: string | null;
  assessmentUserPhone: string | null;
  overallScorePercentage: number | null;
  healthLevel: string | null;
  assessmentId: string | null;
  reportId: string | null;
  resultUrl: string | null;
  reportUrl: string | null;
  expertViewUrl: string | null;
  adminAssessmentUrl: string | null;
  bottlenecks: Array<{ title: string; severity: string }>;
  diagnoses: Array<{ title: string; severity: string }>;
  notes: ConsultationNoteItem[];
}
