import { db } from "@/lib/db";
import type { CreateConsultationRequestInput } from "@/modules/assessment/assessment.types";
import type { ConsultationListFilter } from "./consultation.types";
import type { Prisma } from "@prisma/client";

export async function createConsultationRequest(
  input: CreateConsultationRequestInput,
) {
  return db.consultationRequest.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      message: input.message,
      assessmentSessionId: input.assessmentSessionId,
      reportId: input.reportId,
    },
  });
}

function buildConsultationWhere(
  filter: ConsultationListFilter,
): Prisma.ConsultationRequestWhereInput {
  const where: Prisma.ConsultationRequestWhereInput = {};
  const assessmentSession: Prisma.AssessmentSessionWhereInput = {};

  if (filter.phone) {
    where.OR = [
      { phone: { contains: filter.phone } },
      {
        assessmentSession: {
          user: { phone: { contains: filter.phone } },
        },
      },
    ];
  }

  if (filter.businessName) {
    assessmentSession.organization = {
      businessName: { contains: filter.businessName, mode: "insensitive" },
    };
  }

  if (Object.keys(assessmentSession).length > 0) {
    where.assessmentSession = assessmentSession;
  }

  if (filter.createdFrom || filter.createdTo) {
    where.createdAt = {
      ...(filter.createdFrom ? { gte: filter.createdFrom } : {}),
      ...(filter.createdTo ? { lte: filter.createdTo } : {}),
    };
  }

  return where;
}

const consultationInclude = {
  assessmentSession: {
    include: {
      organization: true,
      user: true,
      overallScore: true,
    },
  },
  report: true,
} as const;

export async function countConsultationRequests(filter: ConsultationListFilter) {
  return db.consultationRequest.count({
    where: buildConsultationWhere(filter),
  });
}

export async function findConsultationRequests(filter: ConsultationListFilter) {
  return db.consultationRequest.findMany({
    where: buildConsultationWhere(filter),
    include: consultationInclude,
    orderBy: { createdAt: "desc" },
    skip: (filter.page - 1) * filter.pageSize,
    take: filter.pageSize,
  });
}
