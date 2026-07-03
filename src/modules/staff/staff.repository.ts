import type { StaffRole } from "@prisma/client";
import { db } from "@/lib/db";

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
