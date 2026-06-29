import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { AdminAssessmentFilter } from "./admin.types";

function buildAssessmentWhere(
  filter: AdminAssessmentFilter,
): Prisma.AssessmentSessionWhereInput {
  const where: Prisma.AssessmentSessionWhereInput = {};

  if (filter.status) {
    where.status = filter.status;
  }

  if (filter.startedFrom || filter.startedTo) {
    where.startedAt = {
      ...(filter.startedFrom ? { gte: filter.startedFrom } : {}),
      ...(filter.startedTo ? { lte: filter.startedTo } : {}),
    };
  }

  if (filter.businessName) {
    where.organization = {
      businessName: {
        contains: filter.businessName,
        mode: "insensitive",
      },
    };
  }

  if (filter.phone) {
    where.user = {
      phone: {
        contains: filter.phone,
      },
    };
  }

  return where;
}

export async function countAssessmentsForAdmin(filter: AdminAssessmentFilter) {
  return db.assessmentSession.count({
    where: buildAssessmentWhere(filter),
  });
}

export async function findAssessmentsForAdmin(filter: AdminAssessmentFilter) {
  const skip = (filter.page - 1) * filter.pageSize;

  return db.assessmentSession.findMany({
    where: buildAssessmentWhere(filter),
    orderBy: { startedAt: "desc" },
    skip,
    take: filter.pageSize,
    include: {
      user: true,
      organization: true,
      overallScore: true,
      report: {
        select: { id: true },
      },
    },
  });
}

export async function findAssessmentForAdmin(assessmentId: string) {
  return db.assessmentSession.findUnique({
    where: { id: assessmentId },
    include: {
      user: true,
      organization: true,
      overallScore: true,
      report: {
        select: { id: true },
      },
    },
  });
}
