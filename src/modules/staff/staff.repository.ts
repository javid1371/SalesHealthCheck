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

export async function pickNextSalesExpert(options?: {
  excludeIds?: string[];
  maxOpenLeadsPerExpert?: number;
  /** Prefer this expert when eligible (active, not excluded, under capacity). */
  preferStaffId?: string | null;
}) {
  const excludeIds = (options?.excludeIds ?? []).filter(Boolean);
  const maxOpen = options?.maxOpenLeadsPerExpert;
  const preferStaffId = options?.preferStaffId?.trim() || null;

  return db.$transaction(async (tx) => {
    const experts = await tx.staffUser.findMany({
      where: {
        role: "sales_expert",
        isActive: true,
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
