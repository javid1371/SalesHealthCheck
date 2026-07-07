import type { Prisma, SalesModel } from "@prisma/client";
import { db } from "@/lib/db";
import type { SalesFunnelAnalysis } from "./sales-funnel.engine";

const funnelInclude = {
  stages: {
    orderBy: { order: "asc" as const },
  },
} satisfies Prisma.SalesFunnelInclude;

export type SalesFunnelRecord = Prisma.SalesFunnelGetPayload<{
  include: typeof funnelInclude;
}>;

export async function findFunnelById(funnelId: string): Promise<SalesFunnelRecord | null> {
  return db.salesFunnel.findUnique({
    where: { id: funnelId },
    include: funnelInclude,
  });
}

export async function listFunnelsByUserId(userId: string) {
  return db.salesFunnel.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { stages: true } },
    },
  });
}

export async function createSalesFunnel(data: {
  userId: string;
  name: string;
  shareToken: string;
  organizationId?: string;
  assessmentSessionId?: string;
  salesModel?: SalesModel;
  averageOrderValue?: number;
  repeatPurchaseRate?: number;
  stages: Array<{
    order: number;
    name: string;
    count: number;
    domainId?: string;
  }>;
}): Promise<SalesFunnelRecord> {
  return db.salesFunnel.create({
    data: {
      userId: data.userId,
      name: data.name,
      shareToken: data.shareToken,
      organizationId: data.organizationId,
      assessmentSessionId: data.assessmentSessionId,
      salesModel: data.salesModel,
      averageOrderValue: data.averageOrderValue,
      repeatPurchaseRate: data.repeatPurchaseRate,
      stages: {
        create: data.stages.map((stage) => ({
          order: stage.order,
          name: stage.name,
          count: stage.count,
          domainId: stage.domainId,
        })),
      },
    },
    include: funnelInclude,
  });
}

export async function updateSalesFunnel(
  funnelId: string,
  data: {
    name?: string;
    organizationId?: string | null;
    assessmentSessionId?: string | null;
    salesModel?: SalesModel | null;
    averageOrderValue?: number | null;
    repeatPurchaseRate?: number | null;
    stages?: Array<{
      order: number;
      name: string;
      count: number;
      domainId?: string;
    }>;
  },
): Promise<SalesFunnelRecord> {
  return db.$transaction(async (tx) => {
    if (data.stages) {
      await tx.salesFunnelStage.deleteMany({ where: { funnelId } });
    }

    return tx.salesFunnel.update({
      where: { id: funnelId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.organizationId !== undefined
          ? { organizationId: data.organizationId }
          : {}),
        ...(data.assessmentSessionId !== undefined
          ? { assessmentSessionId: data.assessmentSessionId }
          : {}),
        ...(data.salesModel !== undefined ? { salesModel: data.salesModel } : {}),
        ...(data.averageOrderValue !== undefined
          ? { averageOrderValue: data.averageOrderValue }
          : {}),
        ...(data.repeatPurchaseRate !== undefined
          ? { repeatPurchaseRate: data.repeatPurchaseRate }
          : {}),
        ...(data.stages
          ? {
              stages: {
                create: data.stages.map((stage) => ({
                  order: stage.order,
                  name: stage.name,
                  count: stage.count,
                  domainId: stage.domainId,
                })),
              },
            }
          : {}),
      },
      include: funnelInclude,
    });
  });
}

export async function deleteSalesFunnel(funnelId: string): Promise<void> {
  await db.salesFunnel.delete({ where: { id: funnelId } });
}

export async function createSalesFunnelSnapshot(
  funnelId: string,
  data: SalesFunnelAnalysis,
) {
  return db.salesFunnelSnapshot.create({
    data: {
      funnelId,
      data: data as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function findAssessmentForFunnelPrefill(
  userId: string,
  assessmentSessionId?: string,
) {
  if (assessmentSessionId) {
    return db.assessmentSession.findFirst({
      where: {
        id: assessmentSessionId,
        userId,
        status: "completed",
      },
      include: {
        organization: true,
      },
    });
  }

  return db.assessmentSession.findFirst({
    where: {
      userId,
      status: "completed",
    },
    orderBy: { completedAt: "desc" },
    include: {
      organization: true,
    },
  });
}
