import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/password-auth";

const { envMock, repoMock } = vi.hoisted(() => ({
  envMock: {
    adminPassword: "admin-secret" as string | undefined,
    adminPasswordHash: undefined as string | undefined,
    salesExpertPassword: "expert-secret" as string | undefined,
    salesExpertPasswordHash: undefined as string | undefined,
  },
  repoMock: {
    findStaffUserByPhone: vi.fn(),
    findStaffUserById: vi.fn(),
    findStaffUsers: vi.fn(),
    createStaffUser: vi.fn(),
    setStaffUserActive: vi.fn(),
    updateStaffUserPassword: vi.fn(),
    countStaffUsersByRole: vi.fn(),
    countActiveAdmins: vi.fn(),
    touchLastLogin: vi.fn(),
  },
}));

vi.mock("@/lib/env", () => ({
  env: envMock,
}));

vi.mock("@/modules/staff/staff.repository", () => repoMock);

import {
  authenticateStaff,
  createStaffUserByAdmin,
  resetStaffUserPasswordByAdmin,
  setStaffUserActiveByAdmin,
} from "@/modules/staff/staff.service";

const adminUser = {
  id: "admin-1",
  name: "Admin User",
  phone: "09111111111",
  passwordHash: hashPassword("admin-pass"),
  role: "admin" as const,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const expertUser = {
  id: "expert-1",
  name: "Expert User",
  phone: "09222222222",
  passwordHash: hashPassword("expert-pass"),
  role: "sales_expert" as const,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("authenticateStaff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.adminPassword = "admin-secret";
    envMock.salesExpertPassword = "expert-secret";
  });

  it("authenticates active staff user with matching role and password", async () => {
    repoMock.findStaffUserByPhone.mockResolvedValue(expertUser);
    repoMock.touchLastLogin.mockResolvedValue(expertUser);

    const result = await authenticateStaff("sales_expert", {
      phone: "09222222222",
      password: "expert-pass",
    });

    expect(result).toEqual({
      role: "sales_expert",
      staffUserId: "expert-1",
      name: "Expert User",
    });
    expect(repoMock.touchLastLogin).toHaveBeenCalledWith("expert-1");
  });

  it("rejects wrong role for existing staff user", async () => {
    repoMock.findStaffUserByPhone.mockResolvedValue(expertUser);

    await expect(
      authenticateStaff("admin", {
        phone: "09222222222",
        password: "expert-pass",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  });

  it("falls back to env password when no staff users exist for role", async () => {
    repoMock.findStaffUserByPhone.mockResolvedValue(null);
    repoMock.countStaffUsersByRole.mockResolvedValue(0);

    const result = await authenticateStaff("admin", {
      phone: "09111111111",
      password: "admin-secret",
    });

    expect(result).toEqual({ role: "admin" });
  });

  it("rejects login when staff users exist but phone is unknown", async () => {
    repoMock.findStaffUserByPhone.mockResolvedValue(null);
    repoMock.countStaffUsersByRole.mockResolvedValue(1);

    await expect(
      authenticateStaff("admin", {
        phone: "09111111111",
        password: "admin-secret",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  });
});

describe("createStaffUserByAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates staff user with hashed password", async () => {
    repoMock.findStaffUserByPhone.mockResolvedValue(null);
    repoMock.createStaffUser.mockResolvedValue(expertUser);

    const result = await createStaffUserByAdmin({
      name: "Expert User",
      phone: "09222222222",
      password: "expert-pass",
      role: "sales_expert",
    });

    expect(repoMock.createStaffUser).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Expert User",
        phone: "09222222222",
        role: "sales_expert",
        passwordHash: expect.stringMatching(/^scrypt:/),
      }),
    );
    expect(result.id).toBe("expert-1");
  });

  it("rejects duplicate phone with 409", async () => {
    repoMock.findStaffUserByPhone.mockResolvedValue(expertUser);

    await expect(
      createStaffUserByAdmin({
        name: "Another",
        phone: "09222222222",
        password: "password123",
        role: "sales_expert",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });
});

describe("setStaffUserActiveByAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prevents deactivating self", async () => {
    await expect(
      setStaffUserActiveByAdmin("admin-1", false, "admin-1"),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("prevents deactivating last active admin", async () => {
    repoMock.findStaffUserById.mockResolvedValue(adminUser);
    repoMock.countActiveAdmins.mockResolvedValue(1);

    await expect(
      setStaffUserActiveByAdmin("admin-1", false, "admin-2"),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("deactivates non-admin staff user", async () => {
    repoMock.findStaffUserById.mockResolvedValue(expertUser);
    repoMock.setStaffUserActive.mockResolvedValue({
      ...expertUser,
      isActive: false,
    });

    const result = await setStaffUserActiveByAdmin(
      "expert-1",
      false,
      "admin-1",
    );

    expect(result.isActive).toBe(false);
  });
});

describe("resetStaffUserPasswordByAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates password hash and returns new password", async () => {
    repoMock.findStaffUserById.mockResolvedValue(expertUser);
    repoMock.updateStaffUserPassword.mockResolvedValue(expertUser);

    const result = await resetStaffUserPasswordByAdmin("expert-1", {
      password: "new-password",
    });

    expect(repoMock.updateStaffUserPassword).toHaveBeenCalledWith(
      "expert-1",
      expect.stringMatching(/^scrypt:/),
    );
    expect(result.password).toBe("new-password");
  });

  it("throws 404 for unknown user", async () => {
    repoMock.findStaffUserById.mockResolvedValue(null);

    await expect(
      resetStaffUserPasswordByAdmin("missing", { password: "new-password" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});
