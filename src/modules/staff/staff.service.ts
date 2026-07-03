import type { StaffRole } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { hashPassword, verifyConfiguredPassword } from "@/lib/password-auth";
import {
  countActiveAdmins,
  countStaffUsersByRole,
  createStaffUser,
  findStaffUserById,
  findStaffUserByPhone,
  findStaffUsers,
  setStaffUserActive,
  touchLastLogin,
  updateStaffUserPassword,
} from "./staff.repository";
import type {
  AuthenticatedStaff,
  CreateStaffUserInput,
  StaffUserSummary,
} from "./staff.types";
import {
  validateCreateStaffUserRequest,
  validateResetStaffPasswordRequest,
  validateStaffLoginRequest,
} from "./staff.validators";

function formatStaffDate(date: Date): string {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toStaffUserSummary(
  user: Awaited<ReturnType<typeof findStaffUsers>>[number],
): StaffUserSummary {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt
      ? formatStaffDate(user.lastLoginAt)
      : null,
    createdAt: formatStaffDate(user.createdAt),
  };
}

function verifyStaffPassword(password: string, passwordHash: string): boolean {
  return verifyConfiguredPassword(password, { hash: passwordHash });
}

function verifyEnvPasswordForRole(role: StaffRole, password: string): boolean {
  if (role === "admin") {
    return verifyConfiguredPassword(password, {
      plain: env.adminPassword,
      hash: env.adminPasswordHash,
    });
  }

  return verifyConfiguredPassword(password, {
    plain: env.salesExpertPassword,
    hash: env.salesExpertPasswordHash,
  });
}

function envPasswordConfiguredForRole(role: StaffRole): boolean {
  if (role === "admin") {
    return Boolean(env.adminPassword || env.adminPasswordHash);
  }

  return Boolean(env.salesExpertPassword || env.salesExpertPasswordHash);
}

export async function authenticateStaff(
  role: StaffRole,
  body: unknown,
): Promise<AuthenticatedStaff> {
  const { phone, password } = validateStaffLoginRequest(body);
  const staffUser = await findStaffUserByPhone(phone);

  if (staffUser) {
    if (staffUser.role !== role) {
      throw new AppError("UNAUTHORIZED", "رمز عبور نادرست است.", 401);
    }

    if (!staffUser.isActive) {
      throw new AppError(
        "UNAUTHORIZED",
        "حساب کاربری غیرفعال است.",
        401,
      );
    }

    if (!verifyStaffPassword(password, staffUser.passwordHash)) {
      throw new AppError("UNAUTHORIZED", "رمز عبور نادرست است.", 401);
    }

    await touchLastLogin(staffUser.id);

    return {
      role,
      staffUserId: staffUser.id,
      name: staffUser.name,
    };
  }

  const roleCount = await countStaffUsersByRole(role);
  if (roleCount > 0) {
    throw new AppError("UNAUTHORIZED", "رمز عبور نادرست است.", 401);
  }

  if (!envPasswordConfiguredForRole(role)) {
    throw new AppError(
      "INTERNAL_ERROR",
      role === "admin"
        ? "Admin login is not configured"
        : "Sales expert login is not configured",
      500,
    );
  }

  if (!verifyEnvPasswordForRole(role, password)) {
    throw new AppError("UNAUTHORIZED", "رمز عبور نادرست است.", 401);
  }

  return { role };
}

export async function listStaffUsers(): Promise<StaffUserSummary[]> {
  const users = await findStaffUsers();
  return users.map(toStaffUserSummary);
}

export async function createStaffUserByAdmin(
  body: unknown,
): Promise<StaffUserSummary> {
  const input: CreateStaffUserInput = validateCreateStaffUserRequest(body);
  const existing = await findStaffUserByPhone(input.phone);

  if (existing) {
    throw new AppError(
      "CONFLICT",
      "کاربری با این شماره موبایل قبلاً ثبت شده است.",
      409,
      { phone: input.phone },
    );
  }

  const user = await createStaffUser({
    name: input.name,
    phone: input.phone,
    passwordHash: hashPassword(input.password),
    role: input.role,
  });

  return toStaffUserSummary(user);
}

export async function setStaffUserActiveByAdmin(
  id: string,
  isActive: boolean,
  actingStaffId: string,
): Promise<StaffUserSummary> {
  if (id === actingStaffId && !isActive) {
    throw new AppError(
      "VALIDATION_ERROR",
      "نمی‌توانید حساب خود را غیرفعال کنید.",
      400,
    );
  }

  const user = await findStaffUserById(id);
  if (!user) {
    throw new AppError("NOT_FOUND", "کاربر یافت نشد.", 404, { id });
  }

  if (!isActive && user.role === "admin" && user.isActive) {
    const activeAdmins = await countActiveAdmins();
    if (activeAdmins <= 1) {
      throw new AppError(
        "VALIDATION_ERROR",
        "حداقل یک ادمین فعال باید باقی بماند.",
        400,
      );
    }
  }

  const updated = await setStaffUserActive(id, isActive);
  return toStaffUserSummary(updated);
}

export async function resetStaffUserPasswordByAdmin(
  id: string,
  body: unknown,
): Promise<{ password: string }> {
  const newPassword = validateResetStaffPasswordRequest(body);
  const user = await findStaffUserById(id);

  if (!user) {
    throw new AppError("NOT_FOUND", "کاربر یافت نشد.", 404, { id });
  }

  await updateStaffUserPassword(id, hashPassword(newPassword));
  return { password: newPassword };
}
