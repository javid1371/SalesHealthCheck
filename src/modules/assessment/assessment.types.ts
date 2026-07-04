import type { LeadSource, PurchaseProbability, SalesModel } from "@prisma/client";
import type { AdminSession, SalesExpertSession, UserSession } from "@/lib/session";
import type { StructuredReport } from "@/types/report";
import type { ReportSpec, ExpertViewSpec } from "@/types/report-spec";

export type ResultAccessInput = {
  token?: string | null;
  userSession?: UserSession | null;
  adminSession?: AdminSession | null;
  salesExpertSession?: SalesExpertSession | null;
};

export type ExpertViewAccessInput = {
  adminToken?: string | null;
  adminSession?: AdminSession | null;
  salesExpertSession?: SalesExpertSession | null;
};

export interface StartAssessmentInput {
  user: {
    name: string;
    email?: string;
  };
  organization: {
    businessName: string;
    industry?: string;
    teamSize: string;
    salesModel: SalesModel;
  };
}

export interface SaveAnswerInput {
  questionId: string;
  selectedOptionId: string;
}

export interface SaveAnswersInput {
  answers: SaveAnswerInput[];
}

export interface UpdateBusinessInfoInput {
  businessName: string;
  industry?: string;
  teamSize: string;
  salesModel: SalesModel;
}

export interface UpdateBusinessMetricsInput {
  monthlyRevenue: number;
  averageOrderValue: number;
  monthlyLeads: number;
  repeatPurchaseRate?: number;
}

export interface UpdateBusinessMetricsResponse {
  assessmentId: string;
  report: {
    id: string;
    reportSpec: ReportSpec | null;
  };
}

export interface FinishAssessmentInput {
  generateAiExplanation?: boolean;
}

export interface AssessmentProgressResponse {
  answeredQuestions: number;
  totalQuestions: number;
  percentage: number;
}

export interface StartAssessmentContext {
  userId: string;
}

export interface StartAssessmentResponse {
  assessmentId: string;
  status: string;
  resultToken: string;
  modelVersion: {
    id: string;
    versionNumber: string;
  };
  nextStep: string;
}

export interface AssessmentStatusResponse {
  assessmentId: string;
  status: string;
  progress: AssessmentProgressResponse;
  organization: {
    businessName: string;
    industry: string | null;
    teamSize: string | null;
    salesModel: SalesModel | null;
  };
  modelVersion: {
    id: string;
    versionNumber: string;
  };
}

export interface SaveAnswersResponse {
  assessmentId: string;
  savedAnswers: number;
  progress: AssessmentProgressResponse;
}

export interface AssessmentAnswersResponse {
  assessmentId: string;
  answers: SaveAnswerInput[];
}

export interface FinishAssessmentResponse {
  assessmentId: string;
  status: string;
  reportId: string;
  resultUrl: string;
}

export interface AssessmentResultResponse {
  assessmentId: string;
  status: string;
  overallScore: {
    rawScore: number;
    maxScore: number;
    percentage: number;
    healthLevel: string;
  };
  domainScores: Array<{
    domainId: string;
    name: string;
    percentage: number;
    healthLevel: string;
    layer: string;
  }>;
  layerScores: Array<{
    layerId: string;
    name: string;
    percentage: number;
    healthLevel: string;
  }>;
  bottlenecks: Array<{
    rank: number;
    domainId: string;
    domainName: string;
    weaknessScore: number;
    domainWeight: number;
    priorityScore: number;
  }>;
  diagnoses: Array<{
    diagnosisKey: string;
    title: string;
    severity: string;
    priority: number;
  }>;
  report: {
    id: string;
    reportStatus: string;
    overallSummary: string;
    layerSummaries: unknown;
    bottleneckSummaries: unknown;
    domainResults?: unknown;
    correctiveActions?: Array<{
      domainSlug: string;
      domainName: string;
      description: string;
    }>;
    diagnosisSummary?: StructuredReport["diagnosisSummary"];
    reportSpec?: ReportSpec | null;
    /** @deprecated Legacy reports */
    actionPlans?: unknown;
  };
  diagnosisEngineVersion?: string;
  spiderChartData: Array<{
    domainSlug: string;
    domainName: string;
    percentage: number;
  }>;
}

export interface ReportResponse {
  reportId: string;
  assessmentId: string;
  reportStatus: string;
  businessName: string | null;
  overallScore: {
    rawScore: number;
    maxScore: number;
    percentage: number;
    healthLevel: string;
  } | null;
  bottlenecks: Array<{
    rank: number;
    domainId: string;
    domainName: string;
    weaknessScore: number;
    domainWeight: number;
    priorityScore: number;
  }>;
  diagnoses: Array<{
    diagnosisKey: string;
    title: string;
    description: string;
    severity: string;
    priority: number;
  }>;
  structuredReport: unknown;
  reportSpec: ReportSpec | null;
  aiGeneratedText: string | null;
  createdAt: string;
}

export interface CreateConsultationRequestInput {
  name: string;
  email?: string;
  phone?: string;
  message?: string;
  assessmentSessionId?: string;
  reportId?: string;
  source?: LeadSource;
  purchaseProbabilityPercent?: number;
  purchaseProbabilityBand?: PurchaseProbability;
}

export interface CreateConsultationRequestResponse {
  id: string;
  createdAt: string;
}

export interface ExpertViewResponse {
  assessmentId: string;
  businessName: string | null;
  expertView: ExpertViewSpec;
}
