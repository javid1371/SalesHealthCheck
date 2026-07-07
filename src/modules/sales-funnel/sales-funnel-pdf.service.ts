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

export { resetBrowserForTests } from "@/modules/report/playwright-browser";

function buildPrintUrl(funnelId: string, token: string): string {
  const base = env.appBaseUrl.replace(/\/$/, "");
  const query = new URLSearchParams({ token });
  return `${base}/funnel/${funnelId}/print?${query.toString()}`;
}

export async function generateFunnelPdf(
  funnelId: string,
  access: FunnelAccessInput = {},
): Promise<Buffer> {
  assertSalesFunnelEnabled();

  if (!env.pdfGenerationEnabled) {
    throw new AppError(
      "pdf_generation_disabled",
      "PDF export is not enabled on this server",
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
      "funnel_not_found",
      "Funnel analysis not available for PDF export",
      404,
      { funnelId },
    );
  }

  let printToken = access.token;
  if (!printToken) {
    const storedFunnel = await findFunnelById(funnelId);
    printToken = storedFunnel?.shareToken;
  }

  if (!printToken) {
    throw new AppError(
      "funnel_access_denied",
      "Access token is required",
      403,
    );
  }

  const printUrl = buildPrintUrl(funnelId, printToken);

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      await page.goto(printUrl, {
        waitUntil: "networkidle",
        timeout: PLAYWRIGHT_RENDER_TIMEOUT_MS,
      });

      await page.waitForSelector(PRINT_READY_SELECTOR, {
        timeout: PLAYWRIGHT_RENDER_TIMEOUT_MS,
      });

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      });

      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("Funnel PDF generation failed:", error);

    throw new AppError(
      "pdf_generation_failed",
      "Failed to generate funnel PDF",
      500,
      { funnelId },
    );
  }
}
