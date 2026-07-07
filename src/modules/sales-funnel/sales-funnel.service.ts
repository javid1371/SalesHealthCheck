import type { SalesModel } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { generateResultToken } from "@/lib/token";
import type { UserSession } from "@/lib/session";
import { computeSalesFunnel } from "./sales-funnel.engine";
import {
  createSalesFunnel,
  createSalesFunnelSnapshot,
  deleteSalesFunnel,
  findAssessmentForFunnelPrefill,
  findFunnelById,
  listFunnelsByUserId,
  updateSalesFunnel,
  type SalesFunnelRecord,
} from "./sales-funnel.repository";
import type {
  CreateFunnelContext,
  CreateFunnelInput,
  FunnelAccessInput,
  FunnelListItem,
  FunnelResponse,
  FunnelSnapshotResponse,
  FunnelStageInput,
  UpdateFunnelInput,
} from "./sales-funnel.types";

const DEFAULT_STAGE_TEMPLATES: Record<SalesModel, string[]> = {
  online: ["ترافیک/بازدید", "سرنخ", "پیشنهاد/سبد", "مشتری"],
  offline: ["مراجعه/تماس", "جلسه/ویزیت", "پیشنهاد", "مشتری"],
  phone: ["تماس ورودی", "تماس واجد شرایط", "پیشنهاد", "مشتری"],
  direct_message: ["پیام/مکالمه", "علاقه‌مند", "پیشنهاد", "مشتری"],
  hybrid: ["سرنخ", "واجد شرایط", "پیشنهاد", "مشتری"],
};

const FALLBACK_OVERALL_CONVERSION = 0.03;

export function assertFunnelAccess(
  params: {
    funnel: { userId: string; shareToken: string };
  } & FunnelAccessInput,
): void {
  const { funnel, token, userSession, adminSession, salesExpertSession } = params;

  if (adminSession || salesExpertSession) {
    return;
  }

  if (token && token === funnel.shareToken) {
    return;
  }

  if (userSession && userSession.userId === funnel.userId) {
    return;
  }

  throw new AppError(
    "funnel_access_denied",
    "Invalid or missing access token",
    403,
  );
}

function defaultStageNames(salesModel: SalesModel | null | undefined): string[] {
  if (salesModel && DEFAULT_STAGE_TEMPLATES[salesModel]) {
    return [...DEFAULT_STAGE_TEMPLATES[salesModel]];
  }
  return [...DEFAULT_STAGE_TEMPLATES.hybrid];
}

function interpolateStageCounts(
  stageNames: string[],
  topCount: number,
  bottomCount: number,
): FunnelStageInput[] {
  if (stageNames.length === 0) return [];
  if (stageNames.length === 1) {
    return [{ name: stageNames[0]!, count: Math.round(bottomCount) }];
  }

  const top = Math.max(topCount, bottomCount, 0);
  const bottom = Math.max(Math.min(topCount, bottomCount), 0);

  if (top === 0) {
    return stageNames.map((name) => ({ name, count: 0 }));
  }

  const ratio = bottom > 0 ? bottom / top : FALLBACK_OVERALL_CONVERSION;
  const counts = stageNames.map((name, index) => {
    const progress = index / (stageNames.length - 1);
    const count = top * ratio ** progress;
    return { name, count: Math.round(count) };
  });

  for (let index = 1; index < counts.length; index += 1) {
    counts[index]!.count = Math.min(counts[index]!.count, counts[index - 1]!.count);
  }

  counts[counts.length - 1]!.count = Math.round(bottom);
  counts[0]!.count = Math.round(top);

  return counts;
}

function deriveCustomerCount(input: {
  monthlyLeads: number | null;
  monthlyRevenue: number | null;
  averageOrderValue: number | null;
  repeatPurchaseRate: number | null;
}): number | null {
  const { monthlyRevenue, averageOrderValue, repeatPurchaseRate, monthlyLeads } = input;

  if (
    monthlyRevenue != null &&
    averageOrderValue != null &&
    averageOrderValue > 0
  ) {
    const repeat = repeatPurchaseRate ?? 1;
    if (repeat <= 0) return null;
    return (monthlyRevenue / averageOrderValue) / repeat;
  }

  if (monthlyLeads != null && monthlyLeads > 0) {
    return monthlyLeads * FALLBACK_OVERALL_CONVERSION;
  }

  return null;
}

function toStageRecords(stages: FunnelStageInput[]) {
  return stages.map((stage, index) => ({
    order: index,
    name: stage.name,
    count: stage.count,
    domainId: stage.domainId,
  }));
}

function toFunnelResponse(funnel: SalesFunnelRecord): FunnelResponse {
  const stages = funnel.stages.map((stage) => ({
    id: stage.id,
    order: stage.order,
    name: stage.name,
    count: stage.count,
    domainId: stage.domainId,
  }));

  const analysis = computeSalesFunnel({
    stages: stages.map((stage) => ({
      name: stage.name,
      count: stage.count,
    })),
    aov: funnel.averageOrderValue ?? undefined,
    repeatRate: funnel.repeatPurchaseRate ?? undefined,
  });

  return {
    id: funnel.id,
    name: funnel.name,
    userId: funnel.userId,
    organizationId: funnel.organizationId,
    assessmentSessionId: funnel.assessmentSessionId,
    salesModel: funnel.salesModel,
    averageOrderValue: funnel.averageOrderValue,
    repeatPurchaseRate: funnel.repeatPurchaseRate,
    shareToken: funnel.shareToken,
    stages,
    analysis,
    createdAt: funnel.createdAt.toISOString(),
    updatedAt: funnel.updatedAt.toISOString(),
  };
}

async function buildPrefillData(
  userId: string,
  input: CreateFunnelInput,
): Promise<{
  organizationId?: string;
  assessmentSessionId?: string;
  salesModel?: SalesModel;
  averageOrderValue?: number;
  repeatPurchaseRate?: number;
  stages: FunnelStageInput[];
}> {
  const assessment = await findAssessmentForFunnelPrefill(
    userId,
    input.assessmentSessionId,
  );

  if (!assessment) {
    throw new AppError(
      "assessment_not_found",
      "No completed assessment found to prefill from",
      404,
    );
  }

  const salesModel =
    input.salesModel ?? assessment.organization.salesModel ?? undefined;
  const stageNames = defaultStageNames(salesModel);
  const monthlyLeads = assessment.monthlyLeads;
  const averageOrderValue =
    input.averageOrderValue ?? assessment.averageOrderValue ?? undefined;
  const repeatPurchaseRate =
    input.repeatPurchaseRate ?? assessment.repeatPurchaseRate ?? undefined;

  const topCount = monthlyLeads ?? 0;
  const bottomCount =
    deriveCustomerCount({
      monthlyLeads: assessment.monthlyLeads,
      monthlyRevenue: assessment.monthlyRevenue,
      averageOrderValue: averageOrderValue ?? null,
      repeatPurchaseRate: repeatPurchaseRate ?? null,
    }) ?? 0;

  return {
    organizationId: input.organizationId ?? assessment.organizationId,
    assessmentSessionId: assessment.id,
    salesModel,
    averageOrderValue,
    repeatPurchaseRate,
    stages: interpolateStageCounts(stageNames, topCount, bottomCount),
  };
}

function resolveCreateStages(
  input: CreateFunnelInput,
  prefill: Awaited<ReturnType<typeof buildPrefillData>> | null,
): FunnelStageInput[] {
  if (input.stages?.length) {
    return input.stages;
  }

  if (prefill?.stages.length) {
    return prefill.stages;
  }

  return defaultStageNames(input.salesModel).map((name) => ({
    name,
    count: 0,
  }));
}

export async function createFunnel(
  context: CreateFunnelContext,
  input: CreateFunnelInput,
): Promise<FunnelResponse> {
  const prefill = input.prefillFromAssessment
    ? await buildPrefillData(context.userId, input)
    : null;

  const stages = resolveCreateStages(input, prefill);

  const funnel = await createSalesFunnel({
    userId: context.userId,
    name: input.name,
    shareToken: generateResultToken(),
    organizationId: prefill?.organizationId ?? input.organizationId,
    assessmentSessionId: prefill?.assessmentSessionId ?? input.assessmentSessionId,
    salesModel: prefill?.salesModel ?? input.salesModel,
    averageOrderValue: prefill?.averageOrderValue ?? input.averageOrderValue,
    repeatPurchaseRate: prefill?.repeatPurchaseRate ?? input.repeatPurchaseRate,
    stages: toStageRecords(stages),
  });

  return toFunnelResponse(funnel);
}

export async function getFunnel(
  funnelId: string,
  access: FunnelAccessInput = {},
): Promise<FunnelResponse> {
  const funnel = await findFunnelById(funnelId);

  if (!funnel) {
    throw new AppError("funnel_not_found", "Sales funnel not found", 404, {
      funnelId,
    });
  }

  assertFunnelAccess({
    funnel: {
      userId: funnel.userId,
      shareToken: funnel.shareToken,
    },
    ...access,
  });

  return toFunnelResponse(funnel);
}

export async function updateFunnel(
  funnelId: string,
  input: UpdateFunnelInput,
  access: FunnelAccessInput = {},
): Promise<FunnelResponse> {
  const funnel = await findFunnelById(funnelId);

  if (!funnel) {
    throw new AppError("funnel_not_found", "Sales funnel not found", 404, {
      funnelId,
    });
  }

  assertFunnelAccess({
    funnel: {
      userId: funnel.userId,
      shareToken: funnel.shareToken,
    },
    ...access,
  });

  const updated = await updateSalesFunnel(funnelId, {
    name: input.name,
    organizationId: input.organizationId,
    assessmentSessionId: input.assessmentSessionId,
    salesModel: input.salesModel,
    averageOrderValue: input.averageOrderValue,
    repeatPurchaseRate: input.repeatPurchaseRate,
    stages: input.stages ? toStageRecords(input.stages) : undefined,
  });

  return toFunnelResponse(updated);
}

export async function listUserFunnels(userSession: UserSession): Promise<FunnelListItem[]> {
  const funnels = await listFunnelsByUserId(userSession.userId);

  return funnels.map((funnel) => ({
    id: funnel.id,
    name: funnel.name,
    stageCount: funnel._count.stages,
    createdAt: funnel.createdAt.toISOString(),
    updatedAt: funnel.updatedAt.toISOString(),
  }));
}

export async function deleteFunnel(
  funnelId: string,
  access: FunnelAccessInput = {},
): Promise<void> {
  const funnel = await findFunnelById(funnelId);

  if (!funnel) {
    throw new AppError("funnel_not_found", "Sales funnel not found", 404, {
      funnelId,
    });
  }

  assertFunnelAccess({
    funnel: {
      userId: funnel.userId,
      shareToken: funnel.shareToken,
    },
    ...access,
  });

  await deleteSalesFunnel(funnelId);
}

export async function captureSnapshot(
  funnelId: string,
  access: FunnelAccessInput = {},
): Promise<FunnelSnapshotResponse> {
  const funnel = await findFunnelById(funnelId);

  if (!funnel) {
    throw new AppError("funnel_not_found", "Sales funnel not found", 404, {
      funnelId,
    });
  }

  assertFunnelAccess({
    funnel: {
      userId: funnel.userId,
      shareToken: funnel.shareToken,
    },
    ...access,
  });

  const analysis = computeSalesFunnel({
    stages: funnel.stages.map((stage) => ({
      name: stage.name,
      count: stage.count,
    })),
    aov: funnel.averageOrderValue ?? undefined,
    repeatRate: funnel.repeatPurchaseRate ?? undefined,
  });

  if (!analysis) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Funnel stages are invalid for snapshot capture",
      400,
    );
  }

  const snapshot = await createSalesFunnelSnapshot(funnelId, analysis);

  return {
    id: snapshot.id,
    funnelId: snapshot.funnelId,
    capturedAt: snapshot.capturedAt.toISOString(),
    data: analysis,
  };
}
