import type { StaffRole } from "@prisma/client";

export type StaffUserSummary = {
  id: string;
  name: string;
  phone: string;
  role: StaffRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type CreateStaffUserInput = {
  name: string;
  phone: string;
  password: string;
  role: StaffRole;
};

export type StaffLoginInput = {
  phone: string;
  password: string;
};

export type AuthenticatedStaff = {
  role: StaffRole;
  staffUserId?: string;
  name?: string;
};
