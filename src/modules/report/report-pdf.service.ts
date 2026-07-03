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

export { resetBrowserForTests } from "./playwright-browser";

function buildPrintUrl(reportId: string, token: string): string {
  const base = env.appBaseUrl.replace(/\/$/, "");
  const query = new URLSearchParams({ token });
  return `${base}/report/${reportId}/print?${query.toString()}`;
}

export async function generateReportPdf(
  reportId: string,
  access: ResultAccessInput = {},
): Promise<Buffer> {
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
      "assessment_access_denied",
      "Access token is required",
      403,
    );
  }

  const report = await getReport(reportId, access);

  if (!report.reportSpec) {
    throw new AppError(
      "report_not_found",
      "Report spec not available for PDF export",
      404,
      { reportId },
    );
  }

  let printToken = access.token;
  if (!printToken) {
    const storedReport = await findReportById(reportId);
    printToken = storedReport?.assessmentSession.resultToken;
  }

  if (!printToken) {
    throw new AppError(
      "assessment_access_denied",
      "Access token is required",
      403,
    );
  }

  const printUrl = buildPrintUrl(reportId, printToken);

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

    console.error("PDF generation failed:", error);

    throw new AppError(
      "pdf_generation_failed",
      "Failed to generate PDF report",
      500,
      { reportId },
    );
  }
}
