import type { AssessmentStatus, LeadStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { AdminAssessmentFilter } from "./admin.types";

function startOfDay(date = new Date()): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(date = new Date()): Date {
  const result = startOfDay(date);
  result.setDate(result.getDate() - 6);
  return result;
}

function startOfMonth(date = new Date()): Date {
  const result = startOfDay(date);
  result.setDate(1);
  return result;
}

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

export async function countAssessmentsByDateRange(
  from: Date,
  to?: Date,
): Promise<number> {
  return db.assessmentSession.count({
    where: {
      startedAt: {
        gte: from,
        ...(to ? { lte: to } : {}),
      },
    },
  });
}

export async function countAssessmentsByStatus(
  status: AssessmentStatus,
): Promise<number> {
  return db.assessmentSession.count({ where: { status } });
}

export async function countAllAssessments(): Promise<number> {
  return db.assessmentSession.count();
}

export async function countAllConsultationRequests(): Promise<number> {
  return db.consultationRequest.count();
}

export async function countConsultationsByStatus(
  status: LeadStatus,
): Promise<number> {
  return db.consultationRequest.count({ where: { status } });
}

export async function countCriticalCompletedConsultations(): Promise<number> {
  return db.consultationRequest.count({
    where: {
      assessmentSession: {
        status: "completed",
        overallScore: {
          healthLevel: { in: ["critical", "weak"] },
        },
      },
    },
  });
}

export async function groupLeadsByAssignee() {
  return db.consultationRequest.groupBy({
    by: ["assignedToId", "status"],
    _count: { id: true },
    where: { assignedToId: { not: null } },
  });
}

export async function findActiveSalesExperts() {
  return db.staffUser.findMany({
    where: { role: "sales_expert", isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export { startOfDay, startOfWeek, startOfMonth };
