import type { AdminSession, SalesExpertSession } from "@/lib/session";

export interface ConsultationListFilter {
  phone?: string;
  businessName?: string;
  createdFrom?: Date;
  createdTo?: Date;
  page: number;
  pageSize: number;
}

export interface ConsultationListItem {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  message: string | null;
  createdAt: string;
  businessName: string | null;
  assessmentUserPhone: string | null;
  overallScorePercentage: number | null;
  assessmentId: string | null;
  reportId: string | null;
  expertViewUrl: string | null;
  adminAssessmentUrl: string | null;
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
