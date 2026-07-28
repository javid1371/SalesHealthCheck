import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT:${url}`);
    throw error;
  }),
);

const sessionMock = vi.hoisted(() => ({
  readAdminSession: vi.fn(),
  readSalesExpertSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/session", () => sessionMock);

vi.mock("@/modules/admin/admin.service", () => ({
  getAdminDashboard: vi.fn(),
}));

vi.mock("@/modules/consultation/consultation.service", () => ({
  getExpertDashboard: vi.fn(),
  listConsultationRequests: vi.fn(),
  listConsultationRequestsForKanban: vi.fn(),
}));

vi.mock("@/modules/staff/staff.service", () => ({
  listStaffUsers: vi.fn(),
}));

import AdminLoginPage from "@/app/admin/login/page";
import ExpertLoginPage from "@/app/expert/login/page";
import StaffLoginPage from "@/app/login/page";
import AdminDashboardPage from "@/app/admin/dashboard/page";
import ExpertDashboardPage from "@/app/expert/dashboard/page";
import ExpertConsultationsPage from "@/app/expert/consultations/page";

async function expectRedirect(
  action: () => Promise<unknown> | unknown,
  path: string,
) {
  await expect(Promise.resolve().then(action)).rejects.toThrow(
    `NEXT_REDIRECT:${path}`,
  );
  expect(redirectMock).toHaveBeenCalledWith(path);
}

describe("staff login and unauth redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMock.readAdminSession.mockResolvedValue(null);
    sessionMock.readSalesExpertSession.mockResolvedValue(null);
  });

  it("redirects legacy /admin/login to unified /login", async () => {
    await expectRedirect(() => AdminLoginPage(), "/login");
  });

  it("redirects legacy /expert/login to unified /login", async () => {
    await expectRedirect(() => ExpertLoginPage(), "/login");
  });

  it("sends authenticated admin from /login to admin dashboard", async () => {
    sessionMock.readAdminSession.mockResolvedValue({ role: "admin" });

    await expectRedirect(() => StaffLoginPage(), "/admin/dashboard");
  });

  it("sends authenticated expert from /login to expert dashboard", async () => {
    sessionMock.readSalesExpertSession.mockResolvedValue({
      role: "sales_expert",
      staffUserId: "expert-1",
      name: "Expert",
    });

    await expectRedirect(() => StaffLoginPage(), "/expert/dashboard");
  });

  it("redirects unauthenticated admin dashboard visitors to /login", async () => {
    await expectRedirect(() => AdminDashboardPage(), "/login");
  });

  it("redirects unauthenticated expert dashboard visitors to /login", async () => {
    await expectRedirect(() => ExpertDashboardPage(), "/login");
  });

  it("redirects unauthenticated consultations visitors to /login", async () => {
    await expectRedirect(
      () =>
        ExpertConsultationsPage({
          searchParams: Promise.resolve({}),
        }),
      "/login",
    );
  });
});
