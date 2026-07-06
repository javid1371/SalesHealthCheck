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
    countUsersVerifiedSince: vi.fn(),
    countUsersStartedInRange: vi.fn(),
    countUsersCompletedInRange: vi.fn(),
    countUsersWithConsultation: vi.fn(),
    countUsersWithNewConsultation: vi.fn(),
    countUsersCriticalLeads: vi.fn(),
    countUsersStartedAllTime: vi.fn(),
    countUsersCompletedAllTime: vi.fn(),
    groupLeadsByAssignee: vi.fn(),
    findActiveSalesExperts: vi.fn(),
  };
});

vi.mock("@/modules/sms-funnel/funnel.repository", () => ({
  getSmsFunnelAdminMetrics: vi.fn(),
  listRecentSmsMessages: vi.fn(),
}));

import {
  getAdminDashboard,
  requireAdminSession,
  verifyAdminPassword,
} from "@/modules/admin/admin.service";
import {
  countAssessmentsByDateRange,
  countUsersVerifiedSince,
  countUsersCompletedInRange,
  countUsersWithConsultation,
  countUsersWithNewConsultation,
  countUsersCriticalLeads,
  countUsersStartedAllTime,
  countUsersCompletedAllTime,
  findActiveSalesExperts,
  groupLeadsByAssignee,
} from "@/modules/admin/admin.repository";
import {
  getSmsFunnelAdminMetrics,
  listRecentSmsMessages,
} from "@/modules/sms-funnel/funnel.repository";

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
    vi.mocked(countUsersVerifiedSince)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(50);
    vi.mocked(countUsersCompletedInRange).mockResolvedValue(15);
    vi.mocked(countUsersStartedAllTime).mockResolvedValue(100);
    vi.mocked(countUsersCompletedAllTime).mockResolvedValue(60);
    vi.mocked(countUsersWithConsultation).mockResolvedValue(20);
    vi.mocked(countUsersCriticalLeads).mockResolvedValue(5);
    vi.mocked(countUsersWithNewConsultation).mockResolvedValue(8);
    vi.mocked(countAssessmentsByDateRange).mockResolvedValue(25);
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
    vi.mocked(getSmsFunnelAdminMetrics).mockResolvedValue({
      smsSent: 12,
      smsPending: 3,
      smsFailed: 1,
      optOutCount: 0,
      linkClicks: 7,
      consultationStarts: 4,
    });
    vi.mocked(listRecentSmsMessages).mockResolvedValue([]);
  });

  it("aggregates user-centric KPIs, funnel, and expert performance", async () => {
    const dashboard = await getAdminDashboard();

    expect(dashboard.kpis).toEqual({
      usersVerifiedToday: 3,
      usersVerifiedThisWeek: 10,
      usersVerifiedThisMonth: 50,
      usersCompletedThisWeek: 15,
      userCompletionRate: 60,
      usersCriticalLeads: 5,
      usersNewConsultations: 8,
      assessmentsThisWeek: 25,
    });
    expect(dashboard.funnel).toEqual({
      started: 100,
      completed: 60,
      consultations: 20,
      completedRate: 60,
      consultationRate: 33,
    });
    expect(countUsersVerifiedSince).toHaveBeenCalledTimes(3);
    expect(countUsersCompletedInRange).toHaveBeenCalledTimes(1);
    expect(countUsersStartedAllTime).toHaveBeenCalledTimes(1);
    expect(countUsersCompletedAllTime).toHaveBeenCalledTimes(1);
    expect(countUsersWithConsultation).toHaveBeenCalledTimes(1);
    expect(countUsersCriticalLeads).toHaveBeenCalledTimes(1);
    expect(countUsersWithNewConsultation).toHaveBeenCalledTimes(1);
    expect(countAssessmentsByDateRange).toHaveBeenCalledTimes(1);
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
    expect(dashboard.smsFunnel.smsSent).toBe(12);
    expect(dashboard.recentSmsMessages).toEqual([]);
  });

  it("returns zero completion rates when no users have started", async () => {
    vi.mocked(countUsersVerifiedSince)
      .mockReset()
      .mockResolvedValue(0);
    vi.mocked(countUsersStartedAllTime).mockResolvedValue(0);
    vi.mocked(countUsersCompletedAllTime).mockResolvedValue(0);
    vi.mocked(countUsersWithConsultation).mockResolvedValue(0);

    const dashboard = await getAdminDashboard();

    expect(dashboard.kpis.userCompletionRate).toBe(0);
    expect(dashboard.funnel.completedRate).toBe(0);
    expect(dashboard.funnel.consultationRate).toBe(0);
  });
});
