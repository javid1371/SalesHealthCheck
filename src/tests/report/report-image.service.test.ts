import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    appBaseUrl: "http://localhost:3000",
    pdfGenerationEnabled: true,
  },
}));

vi.mock("@/lib/env", () => ({
  env: mockEnv,
}));

vi.mock("@/modules/assessment/assessment.service", () => ({
  getReport: vi.fn(),
}));

vi.mock("@/modules/report/report-spec.service", () => ({
  ensureReportSpec: vi.fn(),
}));

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

import { getReport } from "@/modules/assessment/assessment.service";
import { ensureReportSpec } from "@/modules/report/report-spec.service";
import { chromium } from "playwright";
import { resetBrowserForTests } from "@/modules/report/playwright-browser";
import { generateReportChartImage } from "@/modules/report/report-image.service";

const mockGetReport = vi.mocked(getReport);
const mockEnsureReportSpec = vi.mocked(ensureReportSpec);
const mockLaunch = vi.mocked(chromium.launch);

describe("generateReportChartImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBrowserForTests();
    mockEnv.pdfGenerationEnabled = true;
  });

  it("throws pdf_generation_disabled when feature is off", async () => {
    mockEnv.pdfGenerationEnabled = false;

    await expect(
      generateReportChartImage("report-1", { token: "secret-token" }),
    ).rejects.toMatchObject({
      code: "pdf_generation_disabled",
      status: 503,
    });

    expect(mockGetReport).not.toHaveBeenCalled();
  });

  it("throws when token is missing", async () => {
    await expect(generateReportChartImage("report-1", {})).rejects.toMatchObject({
      code: "assessment_access_denied",
      status: 403,
    });
  });

  it("throws when report has no radar chart after ensureReportSpec", async () => {
    mockGetReport.mockResolvedValue({
      reportId: "report-1",
      reportSpec: { charts: [{ kind: "survival", data: {} }] },
    } as Awaited<ReturnType<typeof getReport>>);

    await expect(
      generateReportChartImage("report-1", { token: "secret-token" }),
    ).rejects.toMatchObject({
      code: "chart_not_found",
      status: 404,
    });

    expect(mockEnsureReportSpec).not.toHaveBeenCalled();
  });

  it("uses getReport which lazily ensures reportSpec for legacy reports", async () => {
    mockGetReport.mockResolvedValue({
      reportId: "report-1",
      reportSpec: {
        charts: [{ kind: "radar", data: { domains: [] } }],
      },
    } as Awaited<ReturnType<typeof getReport>>);

    const pngBytes = Buffer.from("89504e470d0a1a0a");
    const mockScreenshot = vi.fn().mockResolvedValue(pngBytes);
    const mockWaitFor = vi.fn().mockResolvedValue(null);
    const mockLocator = vi.fn().mockReturnValue({
      waitFor: mockWaitFor,
      screenshot: mockScreenshot,
    });
    const mockWaitForSelector = vi.fn().mockResolvedValue(null);
    const mockGoto = vi.fn().mockResolvedValue(null);
    const mockClose = vi.fn().mockResolvedValue(undefined);
    const mockNewPage = vi.fn().mockResolvedValue({
      goto: mockGoto,
      waitForSelector: mockWaitForSelector,
      locator: mockLocator,
      close: mockClose,
    });

    mockLaunch.mockResolvedValue({
      newPage: mockNewPage,
    } as Awaited<ReturnType<typeof chromium.launch>>);

    await generateReportChartImage("report-1", { token: "secret-token" });

    expect(mockGetReport).toHaveBeenCalledWith("report-1", {
      token: "secret-token",
    });
    expect(mockEnsureReportSpec).not.toHaveBeenCalled();
  });

  it("returns PNG buffer when Playwright succeeds", async () => {
    mockGetReport.mockResolvedValue({
      reportId: "report-1",
      reportSpec: {
        charts: [{ kind: "radar", data: { domains: [] } }],
      },
    } as Awaited<ReturnType<typeof getReport>>);

    const pngBytes = Buffer.from("89504e470d0a1a0a");
    const mockScreenshot = vi.fn().mockResolvedValue(pngBytes);
    const mockWaitFor = vi.fn().mockResolvedValue(null);
    const mockLocator = vi.fn().mockReturnValue({
      waitFor: mockWaitFor,
      screenshot: mockScreenshot,
    });
    const mockWaitForSelector = vi.fn().mockResolvedValue(null);
    const mockGoto = vi.fn().mockResolvedValue(null);
    const mockClose = vi.fn().mockResolvedValue(undefined);
    const mockNewPage = vi.fn().mockResolvedValue({
      goto: mockGoto,
      waitForSelector: mockWaitForSelector,
      locator: mockLocator,
      close: mockClose,
    });

    mockLaunch.mockResolvedValue({
      newPage: mockNewPage,
    } as Awaited<ReturnType<typeof chromium.launch>>);

    const result = await generateReportChartImage("report-1", {
      token: "secret-token",
    });

    expect(result).toEqual(pngBytes);
    expect(mockGoto).toHaveBeenCalledWith(
      "http://localhost:3000/report/report-1/chart?token=secret-token",
      expect.objectContaining({ waitUntil: "networkidle" }),
    );
    expect(mockScreenshot).toHaveBeenCalledWith({ type: "png" });
    expect(mockClose).toHaveBeenCalled();
  });
});
