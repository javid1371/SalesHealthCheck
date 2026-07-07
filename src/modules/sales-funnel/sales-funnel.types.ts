import type { SalesModel } from "@prisma/client";
import type { AdminSession, SalesExpertSession, UserSession } from "@/lib/session";
import type { SalesFunnelAnalysis } from "./sales-funnel.engine";

export type FunnelAccessInput = {
  token?: string | null;
  userSession?: UserSession | null;
  adminSession?: AdminSession | null;
  salesExpertSession?: SalesExpertSession | null;
};

export type FunnelStageInput = {
  name: string;
  count: number;
  domainId?: string;
};

export type CreateFunnelInput = {
  name: string;
  prefillFromAssessment?: boolean;
  assessmentSessionId?: string;
  organizationId?: string;
  salesModel?: SalesModel;
  averageOrderValue?: number;
  repeatPurchaseRate?: number;
  stages?: FunnelStageInput[];
};

export type UpdateFunnelInput = {
  name?: string;
  salesModel?: SalesModel | null;
  averageOrderValue?: number | null;
  repeatPurchaseRate?: number | null;
  assessmentSessionId?: string | null;
  organizationId?: string | null;
  stages?: FunnelStageInput[];
};

export type FunnelStageResponse = {
  id: string;
  order: number;
  name: string;
  count: number;
  domainId: string | null;
};

export type FunnelResponse = {
  id: string;
  name: string;
  userId: string;
  organizationId: string | null;
  assessmentSessionId: string | null;
  salesModel: SalesModel | null;
  averageOrderValue: number | null;
  repeatPurchaseRate: number | null;
  shareToken: string;
  stages: FunnelStageResponse[];
  analysis: SalesFunnelAnalysis | null;
  createdAt: string;
  updatedAt: string;
};

export type FunnelListItem = {
  id: string;
  name: string;
  stageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type FunnelSnapshotResponse = {
  id: string;
  funnelId: string;
  capturedAt: string;
  data: SalesFunnelAnalysis;
};

export type CreateFunnelContext = {
  userId: string;
};
