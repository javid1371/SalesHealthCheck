import type { LeadStatus, StaffRole } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Open lead statuses that count toward expert capacity.
 * `assessment_in_progress` is excluded so mid-test soft-assign never blocks.
 */
export const CAPACITY_COUNTED_LEAD_STATUSES: LeadStatus[] = [
  "assessment_incomplete",
  "assessment_completed",
  "new",
  "contacted",
  "meeting_scheduled",
  "unreachable",
];

/** Iran (UTC+3:30) offset for calendar-day capacity windows. */
const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;

/** Instant when the current Asia/Tehran calendar day started. */
export function startOfTehranDay(date = new Date()): Date {
  const tehran = new Date(date.getTime() + TEHRAN_OFFSET_MS);
  const y = tehran.getUTCFullYear();
  const m = tehran.getUTCMonth();
  const d = tehran.getUTCDate();
  return new Date(Date.UTC(y, m, d) - TEHRAN_OFFSET_MS);
}

export async function findStaffUserByPhone(phone: string) {
  return db.staffUser.findUnique({ where: { phone } });
}

export async function findStaffUserById(id: string) {
  return db.staffUser.findUnique({ where: { id } });
}

export async function findStaffUsers() {
  return db.staffUser.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}

export async function createStaffUser(input: {
  name: string;
  phone: string;
  passwordHash: string;
  role: StaffRole;
}) {
  return db.staffUser.create({
    data: {
      name: input.name,
      phone: input.phone,
      passwordHash: input.passwordHash,
      role: input.role,
    },
  });
}

export async function setStaffUserActive(id: string, isActive: boolean) {
  return db.staffUser.update({
    where: { id },
    data: { isActive },
  });
}

export async function updateStaffUserPassword(id: string, passwordHash: string) {
  return db.staffUser.update({
    where: { id },
    data: { passwordHash },
  });
}

export async function setStaffAssignmentPaused(
  id: string,
  paused: boolean,
  reason?: string | null,
) {
  return db.staffUser.update({
    where: { id },
    data: paused
      ? {
          assignmentPausedAt: new Date(),
          assignmentPausedReason: reason?.trim() || null,
        }
      : {
          assignmentPausedAt: null,
          assignmentPausedReason: null,
        },
  });
}

export async function setStaffMaxDailyCalls(
  id: string,
  maxDailyCalls: number | null,
) {
  return db.staffUser.update({
    where: { id },
    data: { maxDailyCalls },
  });
}

export async function countStaffUsersByRole(role: StaffRole): Promise<number> {
  return db.staffUser.count({ where: { role } });
}

export async function countActiveAdmins(): Promise<number> {
  return db.staffUser.count({
    where: { role: "admin", isActive: true },
  });
}

export async function touchLastLogin(id: string) {
  return db.staffUser.update({
    where: { id },
    data: { lastLoginAt: new Date() },
  });
}

export async function listActiveSalesExpertsWithPhone() {
  return db.staffUser.findMany({
    where: {
      role: "sales_expert",
      isActive: true,
      NOT: { phone: "" },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export async function listActiveAdminsWithPhone() {
  return db.staffUser.findMany({
    where: {
      role: "admin",
      isActive: true,
      NOT: { phone: "" },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export async function findStaffNamesByIds(ids: string[]) {
  if (ids.length === 0) {
    return new Map<string, string>();
  }

  const rows = await db.staffUser.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });

  return new Map(rows.map((row) => [row.id, row.name]));
}

export async function countCallsForStaffSince(
  staffUserId: string,
  since: Date,
): Promise<number> {
  return db.leadCallLog.count({
    where: {
      staffUserId,
      createdAt: { gte: since },
    },
  });
}

export async function pickNextSalesExpert(options?: {
  excludeIds?: string[];
  maxOpenLeadsPerExpert?: number;
  /** Prefer this expert when eligible (active, not paused, not excluded, under capacity). */
  preferStaffId?: string | null;
}) {
  const excludeIds = (options?.excludeIds ?? []).filter(Boolean);
  const maxOpen = options?.maxOpenLeadsPerExpert;
  const preferStaffId = options?.preferStaffId?.trim() || null;
  const dayStart = startOfTehranDay();

  return db.$transaction(async (tx) => {
    const experts = await tx.staffUser.findMany({
      where: {
        role: "sales_expert",
        isActive: true,
        assignmentPausedAt: null,
        NOT: { phone: "" },
        ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
      },
      orderBy: [
        { lastAssignedAt: { sort: "asc", nulls: "first" } },
        { id: "asc" },
      ],
    });

    if (experts.length === 0) {
      return null;
    }

    let eligible = experts;

    if (maxOpen !== undefined && Number.isFinite(maxOpen) && maxOpen > 0) {
      const expertIds = experts.map((expert) => expert.id);
      const counts = await tx.consultationRequest.groupBy({
        by: ["assignedToId"],
        _count: { id: true },
        where: {
          assignedToId: { in: expertIds },
          status: { in: CAPACITY_COUNTED_LEAD_STATUSES },
        },
      });
      const openCountByExpertId = new Map(
        counts
          .filter((row) => row.assignedToId != null)
          .map((row) => [row.assignedToId as string, row._count.id]),
      );

      eligible = experts.filter(
        (expert) => (openCountByExpertId.get(expert.id) ?? 0) < maxOpen,
      );
    }

    const cappedExperts = eligible.filter(
      (expert) =>
        expert.maxDailyCalls != null &&
        Number.isInteger(expert.maxDailyCalls) &&
        expert.maxDailyCalls > 0,
    );
    if (cappedExperts.length > 0) {
      const cappedIds = cappedExperts.map((expert) => expert.id);
      const callCounts = await tx.leadCallLog.groupBy({
        by: ["staffUserId"],
        _count: { id: true },
        where: {
          staffUserId: { in: cappedIds },
          createdAt: { gte: dayStart },
        },
      });
      const callsByExpertId = new Map(
        callCounts.map((row) => [row.staffUserId, row._count.id]),
      );

      eligible = eligible.filter((expert) => {
        if (
          expert.maxDailyCalls == null ||
          !Number.isInteger(expert.maxDailyCalls) ||
          expert.maxDailyCalls <= 0
        ) {
          return true;
        }
        return (callsByExpertId.get(expert.id) ?? 0) < expert.maxDailyCalls;
      });
    }

    if (eligible.length === 0) {
      return null;
    }

    const preferred =
      preferStaffId != null
        ? eligible.find((expert) => expert.id === preferStaffId)
        : undefined;
    const expert = preferred ?? eligible[0];

    await tx.staffUser.update({
      where: { id: expert.id },
      data: { lastAssignedAt: new Date() },
    });

    return expert;
  });
}
