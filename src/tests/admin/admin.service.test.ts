import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const { envMock, PLAIN_PASSWORD } = vi.hoisted(() => {
  const password = "admin-secret";
  return {
    PLAIN_PASSWORD: password,
    envMock: {
      adminPassword: password as string | undefined,
      adminPasswordHash: undefined as string | undefined,
    },
  };
});

vi.mock("@/lib/env", () => ({
  env: envMock,
}));

vi.mock("@/modules/admin/admin.repository", () => ({
  countAssessmentsForAdmin: vi.fn(),
  findAssessmentsForAdmin: vi.fn(),
  findAssessmentForAdmin: vi.fn(),
}));

import {
  requireAdminSession,
  verifyAdminPassword,
} from "@/modules/admin/admin.service";

describe("verifyAdminPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts the configured password", () => {
    expect(() =>
      verifyAdminPassword({ password: PLAIN_PASSWORD }),
    ).not.toThrow();
  });

  it("rejects wrong password with 401", () => {
    expect(() =>
      verifyAdminPassword({ password: "wrong-password" }),
    ).toThrow(AppError);

    try {
      verifyAdminPassword({ password: "wrong-password" });
    } catch (error) {
      expect(error).toMatchObject({
        code: "UNAUTHORIZED",
        status: 401,
      });
    }
  });

  it("rejects empty password", () => {
    expect(() => verifyAdminPassword({ password: "" })).toThrow(AppError);
  });
});

describe("requireAdminSession", () => {
  it("passes when admin session is present", () => {
    expect(() =>
      requireAdminSession({ role: "admin" }),
    ).not.toThrow();
  });

  it("throws 401 when session is missing", () => {
    expect(() => requireAdminSession(null)).toThrow(AppError);

    try {
      requireAdminSession(null);
    } catch (error) {
      expect(error).toMatchObject({
        code: "UNAUTHORIZED",
        status: 401,
      });
    }
  });
});

describe("verifyAdminPassword when not configured", () => {
  beforeEach(() => {
    envMock.adminPassword = undefined;
    envMock.adminPasswordHash = undefined;
  });

  afterEach(() => {
    envMock.adminPassword = PLAIN_PASSWORD;
    envMock.adminPasswordHash = undefined;
  });

  it("returns 500 when neither password nor hash is set", () => {
    expect(() =>
      verifyAdminPassword({ password: "anything" }),
    ).toThrow(AppError);

    try {
      verifyAdminPassword({ password: "anything" });
    } catch (error) {
      expect(error).toMatchObject({
        code: "INTERNAL_ERROR",
        status: 500,
      });
    }
  });
});
