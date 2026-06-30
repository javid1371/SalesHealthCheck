import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const { envMock, PLAIN_PASSWORD } = vi.hoisted(() => {
  const password = "expert-secret";
  return {
    PLAIN_PASSWORD: password,
    envMock: {
      salesExpertPassword: password as string | undefined,
      salesExpertPasswordHash: undefined as string | undefined,
    },
  };
});

vi.mock("@/lib/env", () => ({
  env: envMock,
}));

vi.mock("@/modules/consultation/consultation.repository", () => ({
  countConsultationRequests: vi.fn(),
  findConsultationRequests: vi.fn(),
  createConsultationRequest: vi.fn(),
}));

import {
  hasConsultationsAccess,
  requireConsultationsAccess,
  verifySalesExpertPassword,
} from "@/modules/consultation/consultation.service";

describe("verifySalesExpertPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts the configured password", () => {
    expect(() =>
      verifySalesExpertPassword({ password: PLAIN_PASSWORD }),
    ).not.toThrow();
  });

  it("rejects wrong password with 401", () => {
    expect(() =>
      verifySalesExpertPassword({ password: "wrong-password" }),
    ).toThrow(AppError);
  });
});

describe("consultations access", () => {
  it("allows admin session", () => {
    expect(
      hasConsultationsAccess({
        adminSession: { role: "admin" },
        salesExpertSession: null,
      }),
    ).toBe(true);
  });

  it("allows sales expert session", () => {
    expect(
      hasConsultationsAccess({
        adminSession: null,
        salesExpertSession: { role: "sales_expert" },
      }),
    ).toBe(true);
  });

  it("requires login when both sessions are missing", () => {
    expect(() =>
      requireConsultationsAccess({
        adminSession: null,
        salesExpertSession: null,
      }),
    ).toThrow(AppError);
  });
});
