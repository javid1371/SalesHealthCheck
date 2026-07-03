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

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

import { getReport } from "@/modules/assessment/assessment.service";
import { chromium } from "playwright";
import {
  generateReportPdf,
  resetBrowserForTests,
} from "@/modules/report/report-pdf.service";

const mockGetReport = vi.mocked(getReport);
const mockLaunch = vi.mocked(chromium.launch);

describe("generateReportPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBrowserForTests();
    mockEnv.pdfGenerationEnabled = true;
  });

  it("throws pdf_generation_disabled when feature is off", async () => {
    mockEnv.pdfGenerationEnabled = false;

    await expect(
      generateReportPdf("report-1", { token: "secret-token" }),
    ).rejects.toMatchObject({
      code: "pdf_generation_disabled",
      status: 503,
    });

    expect(mockGetReport).not.toHaveBeenCalled();
  });

  it("throws when token is missing", async () => {
    await expect(generateReportPdf("report-1", {})).rejects.toMatchObject({
      code: "assessment_access_denied",
      status: 403,
    });
  });

  it("throws when report has no reportSpec", async () => {
    mockGetReport.mockResolvedValue({
      reportId: "report-1",
      reportSpec: null,
    } as Awaited<ReturnType<typeof getReport>>);

    await expect(
      generateReportPdf("report-1", { token: "secret-token" }),
    ).rejects.toMatchObject({
      code: "report_not_found",
      status: 404,
    });
  });

  it("returns PDF buffer when Playwright succeeds", async () => {
    mockGetReport.mockResolvedValue({
      reportId: "report-1",
      reportSpec: { version: "1" },
    } as Awaited<ReturnType<typeof getReport>>);

    const pdfBytes = Buffer.from("%PDF-1.4 mock");
    const mockPdf = vi.fn().mockResolvedValue(pdfBytes);
    const mockWaitForSelector = vi.fn().mockResolvedValue(null);
    const mockGoto = vi.fn().mockResolvedValue(null);
    const mockClose = vi.fn().mockResolvedValue(undefined);
    const mockNewPage = vi.fn().mockResolvedValue({
      goto: mockGoto,
      waitForSelector: mockWaitForSelector,
      pdf: mockPdf,
      close: mockClose,
    });

    mockLaunch.mockResolvedValue({
      newPage: mockNewPage,
    } as Awaited<ReturnType<typeof chromium.launch>>);

    const result = await generateReportPdf("report-1", { token: "secret-token" });

    expect(result).toEqual(pdfBytes);
    expect(mockGoto).toHaveBeenCalledWith(
      "http://localhost:3000/report/report-1/print?token=secret-token",
      expect.objectContaining({ waitUntil: "networkidle" }),
    );
    expect(mockPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      }),
    );
    expect(mockClose).toHaveBeenCalled();
  });

  it("wraps Playwright failures in pdf_generation_failed", async () => {
    mockGetReport.mockResolvedValue({
      reportId: "report-1",
      reportSpec: { version: "1" },
    } as Awaited<ReturnType<typeof getReport>>);

    mockLaunch.mockRejectedValue(new Error("browser failed"));

    await expect(
      generateReportPdf("report-1", { token: "secret-token" }),
    ).rejects.toMatchObject({
      code: "pdf_generation_failed",
      status: 500,
    });
  });
});
