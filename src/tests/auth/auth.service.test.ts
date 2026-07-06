import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { resetRateLimitStore } from "@/lib/rate-limit";

const { TEST_SECRET } = vi.hoisted(() => ({
  TEST_SECRET: "test-secret-at-least-32-chars-long",
}));

vi.mock("@/lib/env", () => ({
  env: {
    authSessionSecret: TEST_SECRET,
    otpTtlSeconds: 300,
    otpMaxAttempts: 3,
    kavenegarApiKey: undefined,
    kavenegarOtpTemplate: undefined,
  },
}));

vi.mock("@/modules/auth/otp.repository", () => ({
  consumeActiveOtpCodesForPhone: vi.fn(),
  createOtpCode: vi.fn(),
  findLatestActiveOtpCode: vi.fn(),
  incrementOtpAttempts: vi.fn(),
  consumeOtpCode: vi.fn(),
  findLatestUserByPhone: vi.fn(),
  createUserWithPhone: vi.fn(),
  markPhoneVerified: vi.fn(),
}));

vi.mock("@/modules/auth/sms/kavenegar", () => ({
  createSmsSenderFromSettings: vi.fn(() =>
    Promise.resolve({
      sendOtp: vi.fn().mockResolvedValue(undefined),
    }),
  ),
}));

const mockHookPhoneVerified = vi.fn();

vi.mock("@/modules/sms-funnel/hooks", () => ({
  hookPhoneVerified: (...args: unknown[]) => mockHookPhoneVerified(...args),
}));

import {
  consumeActiveOtpCodesForPhone,
  consumeOtpCode,
  createOtpCode,
  createUserWithPhone,
  findLatestActiveOtpCode,
  findLatestUserByPhone,
  incrementOtpAttempts,
  markPhoneVerified,
} from "@/modules/auth/otp.repository";
import {
  OTP_SEND_SUCCESS_MESSAGE,
  OTP_VERIFY_INVALID_MESSAGE,
} from "@/modules/auth/auth.types";
import { sendOtp, verifyOtp } from "@/modules/auth/auth.service";

function hashOtpCode(phone: string, code: string): string {
  return createHash("sha256")
    .update(`${phone}:${code}:${TEST_SECRET}`)
    .digest("hex");
}

const PHONE = "09123456789";

describe("sendOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitStore();
  });

  it("creates an OTP record and returns a generic success message", async () => {
    vi.mocked(createOtpCode).mockResolvedValue({
      id: "otp-1",
      phone: PHONE,
      codeHash: "hash",
      expiresAt: new Date(),
      attempts: 0,
      consumedAt: null,
      createdAt: new Date(),
    });

    const result = await sendOtp({ phone: "+98 912 345 6789" });

    expect(result.message).toBe(OTP_SEND_SUCCESS_MESSAGE);
    expect(result.devCode).toMatch(/^\d{6}$/);
    expect(consumeActiveOtpCodesForPhone).toHaveBeenCalledWith(PHONE);
    expect(createOtpCode).toHaveBeenCalledOnce();
    const createArgs = vi.mocked(createOtpCode).mock.calls[0]![0];
    expect(createArgs.phone).toBe(PHONE);
    expect(createArgs.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createArgs.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects rapid resend for the same phone", async () => {
    vi.mocked(createOtpCode).mockResolvedValue({} as never);

    await sendOtp({ phone: PHONE });
    await expect(sendOtp({ phone: PHONE })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 429,
    });
  });
});

describe("verifyOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when no active OTP exists", async () => {
    vi.mocked(findLatestActiveOtpCode).mockResolvedValue(null);

    await expect(
      verifyOtp({ phone: PHONE, code: "123456" }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: OTP_VERIFY_INVALID_MESSAGE,
      status: 401,
    });
  });

  it("rejects when max attempts exceeded", async () => {
    vi.mocked(findLatestActiveOtpCode).mockResolvedValue({
      id: "otp-1",
      phone: PHONE,
      codeHash: hashOtpCode(PHONE, "123456"),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 3,
      consumedAt: null,
      createdAt: new Date(),
    });

    await expect(
      verifyOtp({ phone: PHONE, code: "123456" }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
    expect(incrementOtpAttempts).not.toHaveBeenCalled();
  });

  it("increments attempts and rejects wrong code", async () => {
    vi.mocked(findLatestActiveOtpCode).mockResolvedValue({
      id: "otp-1",
      phone: PHONE,
      codeHash: hashOtpCode(PHONE, "123456"),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      consumedAt: null,
      createdAt: new Date(),
    });

    await expect(
      verifyOtp({ phone: PHONE, code: "999999" }),
    ).rejects.toThrow(AppError);

    expect(incrementOtpAttempts).toHaveBeenCalledWith("otp-1");
    expect(consumeOtpCode).not.toHaveBeenCalled();
  });

  it("returns existing user id and marks phone verified when needed", async () => {
    vi.mocked(findLatestActiveOtpCode).mockResolvedValue({
      id: "otp-1",
      phone: PHONE,
      codeHash: hashOtpCode(PHONE, "123456"),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      consumedAt: null,
      createdAt: new Date(),
    });
    vi.mocked(findLatestUserByPhone).mockResolvedValue({
      id: "user-1",
      name: null,
      email: null,
      phone: PHONE,
      phoneVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await verifyOtp({ phone: PHONE, code: "123456" });

    expect(result).toEqual({ userId: "user-1" });
    expect(consumeOtpCode).toHaveBeenCalledWith("otp-1");
    expect(markPhoneVerified).toHaveBeenCalledWith("user-1");
    expect(mockHookPhoneVerified).toHaveBeenCalledWith("user-1");
    expect(createUserWithPhone).not.toHaveBeenCalled();
  });

  it("does not re-verify or trigger funnel hook when phone is already verified", async () => {
    vi.mocked(findLatestActiveOtpCode).mockResolvedValue({
      id: "otp-1",
      phone: PHONE,
      codeHash: hashOtpCode(PHONE, "123456"),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      consumedAt: null,
      createdAt: new Date(),
    });
    vi.mocked(findLatestUserByPhone).mockResolvedValue({
      id: "user-1",
      name: null,
      email: null,
      phone: PHONE,
      phoneVerifiedAt: new Date("2024-01-01"),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await verifyOtp({ phone: PHONE, code: "123456" });

    expect(result).toEqual({ userId: "user-1" });
    expect(markPhoneVerified).not.toHaveBeenCalled();
    expect(mockHookPhoneVerified).not.toHaveBeenCalled();
  });

  it("creates a new user when phone is not registered", async () => {
    vi.mocked(findLatestActiveOtpCode).mockResolvedValue({
      id: "otp-1",
      phone: PHONE,
      codeHash: hashOtpCode(PHONE, "654321"),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      consumedAt: null,
      createdAt: new Date(),
    });
    vi.mocked(findLatestUserByPhone).mockResolvedValue(null);
    vi.mocked(createUserWithPhone).mockResolvedValue({
      id: "user-new",
      name: null,
      email: null,
      phone: PHONE,
      phoneVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await verifyOtp({ phone: PHONE, code: "654321" });

    expect(result).toEqual({ userId: "user-new" });
    expect(createUserWithPhone).toHaveBeenCalledWith(PHONE);
    expect(markPhoneVerified).toHaveBeenCalledWith("user-new");
    expect(mockHookPhoneVerified).toHaveBeenCalledWith("user-new");
  });
});
