import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { getReport } from "@/modules/assessment/assessment.service";
import { findReportById } from "@/modules/assessment/assessment.repository";
import type { ResultAccessInput } from "@/modules/assessment/assessment.types";
import {
  getBrowser,
  PLAYWRIGHT_RENDER_TIMEOUT_MS,
  PRINT_READY_SELECTOR,
} from "./playwright-browser";

const CHART_CAPTURE_SELECTOR = "#report-chart-capture";

function buildChartUrl(reportId: string, token: string): string {
  const base = env.appBaseUrl.replace(/\/$/, "");
  const query = new URLSearchParams({ token });
  return `${base}/report/${reportId}/chart?${query.toString()}`;
}

export async function generateReportChartImage(
  reportId: string,
  access: ResultAccessInput = {},
): Promise<Buffer> {
  if (!env.pdfGenerationEnabled) {
    throw new AppError(
      "pdf_generation_disabled",
      "Chart image export is not enabled on this server",
      503,
    );
  }

  const hasAccessCredential =
    !!access.token ||
    !!access.userSession ||
    !!access.adminSession ||
    !!access.salesExpertSession;
  if (!hasAccessCredential) {
    throw new AppError(
      "assessment_access_denied",
      "Access token is required",
      403,
    );
  }

  const report = await getReport(reportId, access);

  if (!report.reportSpec) {
    throw new AppError(
      "report_not_found",
      "Report spec not available for chart export",
      404,
      { reportId },
    );
  }

  const hasRadarChart = report.reportSpec.charts.some(
    (chart) => chart.kind === "radar",
  );
  if (!hasRadarChart) {
    throw new AppError(
      "chart_not_found",
      "Radar chart not available for this report",
      404,
      { reportId },
    );
  }

  let chartToken = access.token;
  if (!chartToken) {
    const storedReport = await findReportById(reportId);
    chartToken = storedReport?.assessmentSession.resultToken;
  }

  if (!chartToken) {
    throw new AppError(
      "assessment_access_denied",
      "Access token is required",
      403,
    );
  }

  const chartUrl = buildChartUrl(reportId, chartToken);

  try {
    const browser = await getBrowser();
    const page = await browser.newPage({
      viewport: { width: 800, height: 800 },
    });

    try {
      await page.goto(chartUrl, {
        waitUntil: "networkidle",
        timeout: PLAYWRIGHT_RENDER_TIMEOUT_MS,
      });

      await page.waitForSelector(PRINT_READY_SELECTOR, {
        timeout: PLAYWRIGHT_RENDER_TIMEOUT_MS,
      });

      const chartElement = page.locator(CHART_CAPTURE_SELECTOR);
      await chartElement.waitFor({
        state: "visible",
        timeout: PLAYWRIGHT_RENDER_TIMEOUT_MS,
      });

      const screenshot = await chartElement.screenshot({ type: "png" });

      return Buffer.from(screenshot);
    } finally {
      await page.close();
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("Chart image generation failed:", error);

    throw new AppError(
      "chart_generation_failed",
      "Failed to generate chart image",
      500,
      { reportId },
    );
  }
}
