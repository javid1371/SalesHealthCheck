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

vi.mock("@/modules/admin/admin.repository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/modules/admin/admin.repository")>();
  return {
    ...actual,
    countAssessmentsForAdmin: vi.fn(),
    findAssessmentsForAdmin: vi.fn(),
    findAssessmentForAdmin: vi.fn(),
    countAssessmentsByDateRange: vi.fn(),
    countAssessmentsByStatus: vi.fn(),
    countAllAssessments: vi.fn(),
    countAllConsultationRequests: vi.fn(),
    countConsultationsByStatus: vi.fn(),
    countCriticalCompletedConsultations: vi.fn(),
    groupLeadsByAssignee: vi.fn(),
    findActiveSalesExperts: vi.fn(),
  };
});

import {
  getAdminDashboard,
  requireAdminSession,
  verifyAdminPassword,
} from "@/modules/admin/admin.service";
import {
  countAssessmentsByDateRange,
  countAssessmentsByStatus,
  countAllAssessments,
  countAllConsultationRequests,
  countConsultationsByStatus,
  countCriticalCompletedConsultations,
  findActiveSalesExperts,
  groupLeadsByAssignee,
} from "@/modules/admin/admin.repository";

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

  it("passes with extended admin session fields", () => {
    expect(() =>
      requireAdminSession({
        role: "admin",
        staffUserId: "admin-1",
        name: "Admin User",
      }),
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

describe("getAdminDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(countAssessmentsByDateRange).mockResolvedValue(10);
    vi.mocked(countAllAssessments).mockResolvedValue(100);
    vi.mocked(countAssessmentsByStatus).mockResolvedValue(60);
    vi.mocked(countAllConsultationRequests).mockResolvedValue(20);
    vi.mocked(countCriticalCompletedConsultations).mockResolvedValue(5);
    vi.mocked(countConsultationsByStatus).mockResolvedValue(8);
    vi.mocked(findActiveSalesExperts).mockResolvedValue([
      { id: "expert-1", name: "Expert One" },
    ]);
    vi.mocked(groupLeadsByAssignee).mockResolvedValue([
      {
        assignedToId: "expert-1",
        status: "new",
        _count: { id: 3 },
      },
      {
        assignedToId: "expert-1",
        status: "closed_won",
        _count: { id: 2 },
      },
    ] as never);
  });

  it("aggregates KPIs, funnel, and expert performance", async () => {
    const dashboard = await getAdminDashboard();

    expect(dashboard.kpis.completionRate).toBe(60);
    expect(dashboard.kpis.newConsultations).toBe(8);
    expect(dashboard.funnel.started).toBe(100);
    expect(dashboard.funnel.consultations).toBe(20);
    expect(dashboard.expertPerformance).toEqual([
      {
        staffUserId: "expert-1",
        name: "Expert One",
        assigned: 5,
        open: 3,
        closedWon: 2,
        closedLost: 0,
      },
    ]);
  });
});
