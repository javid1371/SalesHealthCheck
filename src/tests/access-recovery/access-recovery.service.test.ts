import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

vi.mock("@/modules/assessment/assessment.repository", () => ({
  findUserByEmailOrPhone: vi.fn(),
}));

vi.mock("@/modules/access-recovery/access-recovery.repository", () => ({
  findLatestCompletedSession: vi.fn(),
}));

vi.mock("@/modules/access-recovery/access-recovery.email", () => ({
  sendRecoveryEmail: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    appBaseUrl: "https://sales.example.com",
    resendApiKey: "re_test",
    emailFrom: "noreply@example.com",
  },
}));

import { findUserByEmailOrPhone } from "@/modules/assessment/assessment.repository";
import { sendRecoveryEmail } from "@/modules/access-recovery/access-recovery.email";
import { findLatestCompletedSession } from "@/modules/access-recovery/access-recovery.repository";
import {
  recoverAccess,
} from "@/modules/access-recovery/access-recovery.service";
import { RECOVER_ACCESS_SUCCESS_MESSAGE } from "@/modules/access-recovery/access-recovery.types";

describe("recoverAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns generic success when user is not found", async () => {
    vi.mocked(findUserByEmailOrPhone).mockResolvedValue(null);

    const result = await recoverAccess({ email: "missing@example.com" });

    expect(result.message).toBe(RECOVER_ACCESS_SUCCESS_MESSAGE);
    expect(sendRecoveryEmail).not.toHaveBeenCalled();
  });

  it("returns generic success when user has no completed assessment", async () => {
    vi.mocked(findUserByEmailOrPhone).mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@example.com",
      phone: null,
      phoneVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(findLatestCompletedSession).mockResolvedValue(null);

    const result = await recoverAccess({ email: "test@example.com" });

    expect(result.message).toBe(RECOVER_ACCESS_SUCCESS_MESSAGE);
    expect(sendRecoveryEmail).not.toHaveBeenCalled();
  });

  it("sends recovery email for completed assessment", async () => {
    vi.mocked(findUserByEmailOrPhone).mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@example.com",
      phone: null,
      phoneVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(findLatestCompletedSession).mockResolvedValue({
      id: "assessment-1",
      resultToken: "token-abc",
    });
    vi.mocked(sendRecoveryEmail).mockResolvedValue(undefined);

    const result = await recoverAccess({ email: "test@example.com" });

    expect(result.message).toBe(RECOVER_ACCESS_SUCCESS_MESSAGE);
    expect(sendRecoveryEmail).toHaveBeenCalledWith({
      to: "test@example.com",
      resultUrl:
        "https://sales.example.com/assessment/assessment-1/result?token=token-abc",
    });
  });

  it("uses stored email when lookup is by phone", async () => {
    vi.mocked(findUserByEmailOrPhone).mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "stored@example.com",
      phone: "09123456789",
      phoneVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(findLatestCompletedSession).mockResolvedValue({
      id: "assessment-2",
      resultToken: "token-xyz",
    });

    await recoverAccess({ phone: "09123456789" });

    expect(sendRecoveryEmail).toHaveBeenCalledWith({
      to: "stored@example.com",
      resultUrl:
        "https://sales.example.com/assessment/assessment-2/result?token=token-xyz",
    });
  });

  it("returns generic success without sending when user has no email", async () => {
    vi.mocked(findUserByEmailOrPhone).mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: null,
      phone: "09123456789",
      phoneVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(findLatestCompletedSession).mockResolvedValue({
      id: "assessment-1",
      resultToken: "token-abc",
    });

    const result = await recoverAccess({ phone: "09123456789" });

    expect(result.message).toBe(RECOVER_ACCESS_SUCCESS_MESSAGE);
    expect(sendRecoveryEmail).not.toHaveBeenCalled();
  });

  it("rejects invalid email format", async () => {
    await expect(recoverAccess({ email: "not-an-email" })).rejects.toThrow(
      AppError,
    );
    expect(sendRecoveryEmail).not.toHaveBeenCalled();
  });

  it("rejects empty body", async () => {
    await expect(recoverAccess({})).rejects.toThrow(AppError);
  });
});
