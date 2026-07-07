import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import {
  getBrowser,
  PLAYWRIGHT_RENDER_TIMEOUT_MS,
  PRINT_READY_SELECTOR,
} from "@/modules/report/playwright-browser";
import { assertSalesFunnelEnabled } from "./sales-funnel.guards";
import { findFunnelById } from "./sales-funnel.repository";
import { getFunnel } from "./sales-funnel.service";
import type { FunnelAccessInput } from "./sales-funnel.types";

const CHART_CAPTURE_SELECTOR = "#funnel-chart-capture";

function buildChartUrl(funnelId: string, token: string): string {
  const base = env.appBaseUrl.replace(/\/$/, "");
  const query = new URLSearchParams({ token });
  return `${base}/funnel/${funnelId}/chart?${query.toString()}`;
}

export async function generateFunnelChartImage(
  funnelId: string,
  access: FunnelAccessInput = {},
): Promise<Buffer> {
  assertSalesFunnelEnabled();

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
      "funnel_access_denied",
      "Access token is required",
      403,
    );
  }

  const funnel = await getFunnel(funnelId, access);

  if (!funnel.analysis) {
    throw new AppError(
      "chart_not_found",
      "Funnel chart not available for image export",
      404,
      { funnelId },
    );
  }

  let chartToken = access.token;
  if (!chartToken) {
    const storedFunnel = await findFunnelById(funnelId);
    chartToken = storedFunnel?.shareToken;
  }

  if (!chartToken) {
    throw new AppError(
      "funnel_access_denied",
      "Access token is required",
      403,
    );
  }

  const chartUrl = buildChartUrl(funnelId, chartToken);

  try {
    const browser = await getBrowser();
    const page = await browser.newPage({
      viewport: { width: 900, height: 1200 },
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

    console.error("Funnel chart image generation failed:", error);

    throw new AppError(
      "chart_generation_failed",
      "Failed to generate funnel chart image",
      500,
      { funnelId },
    );
  }
}
