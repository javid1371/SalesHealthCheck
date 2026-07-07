import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    appBaseUrl: "http://localhost:3000",
    pdfGenerationEnabled: true,
    salesFunnelEnabled: true,
  },
}));

vi.mock("@/lib/env", () => ({
  env: mockEnv,
}));

vi.mock("@/modules/sales-funnel/sales-funnel.service", () => ({
  getFunnel: vi.fn(),
}));

vi.mock("@/modules/sales-funnel/sales-funnel.repository", () => ({
  findFunnelById: vi.fn(),
}));

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

import { getFunnel } from "@/modules/sales-funnel/sales-funnel.service";
import { chromium } from "playwright";
import { resetBrowserForTests } from "@/modules/report/playwright-browser";
import { generateFunnelChartImage } from "@/modules/sales-funnel/sales-funnel-image.service";

const mockGetFunnel = vi.mocked(getFunnel);
const mockLaunch = vi.mocked(chromium.launch);

const sampleAnalysis = {
  stages: [{ name: "سرنخ", count: 100 }],
  transitions: [],
  overallConversionRate: 0.1,
  revenueForecast: null,
  bottleneck: null,
};

describe("generateFunnelChartImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBrowserForTests();
    mockEnv.pdfGenerationEnabled = true;
    mockEnv.salesFunnelEnabled = true;
  });

  it("throws sales_funnel_disabled when module is off", async () => {
    mockEnv.salesFunnelEnabled = false;

    await expect(
      generateFunnelChartImage("funnel-1", { token: "secret-token" }),
    ).rejects.toMatchObject({
      code: "sales_funnel_disabled",
      status: 404,
    });

    expect(mockGetFunnel).not.toHaveBeenCalled();
  });

  it("throws pdf_generation_disabled when feature is off", async () => {
    mockEnv.pdfGenerationEnabled = false;

    await expect(
      generateFunnelChartImage("funnel-1", { token: "secret-token" }),
    ).rejects.toMatchObject({
      code: "pdf_generation_disabled",
      status: 503,
    });

    expect(mockGetFunnel).not.toHaveBeenCalled();
  });

  it("throws when token is missing", async () => {
    await expect(generateFunnelChartImage("funnel-1", {})).rejects.toMatchObject({
      code: "funnel_access_denied",
      status: 403,
    });
  });

  it("throws when funnel has no analysis", async () => {
    mockGetFunnel.mockResolvedValue({
      id: "funnel-1",
      analysis: null,
    } as Awaited<ReturnType<typeof getFunnel>>);

    await expect(
      generateFunnelChartImage("funnel-1", { token: "secret-token" }),
    ).rejects.toMatchObject({
      code: "chart_not_found",
      status: 404,
    });
  });

  it("returns PNG buffer when Playwright succeeds", async () => {
    mockGetFunnel.mockResolvedValue({
      id: "funnel-1",
      analysis: sampleAnalysis,
    } as Awaited<ReturnType<typeof getFunnel>>);

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

    const result = await generateFunnelChartImage("funnel-1", {
      token: "secret-token",
    });

    expect(result).toEqual(pngBytes);
    expect(mockGoto).toHaveBeenCalledWith(
      "http://localhost:3000/funnel/funnel-1/chart?token=secret-token",
      expect.objectContaining({ waitUntil: "networkidle" }),
    );
    expect(mockScreenshot).toHaveBeenCalledWith({ type: "png" });
    expect(mockClose).toHaveBeenCalled();
  });
});
