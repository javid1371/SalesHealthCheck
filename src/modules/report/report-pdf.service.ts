import type { Browser } from "playwright";
import { chromium } from "playwright";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { getReport } from "@/modules/assessment/assessment.service";
import { findReportById } from "@/modules/assessment/assessment.repository";
import type { ResultAccessInput } from "@/modules/assessment/assessment.types";

const PDF_TIMEOUT_MS = 30_000;
const PRINT_READY_SELECTOR = "html[data-print-ready='true']";

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserPromise;
}

export function resetBrowserForTests(): void {
  browserPromise = null;
}

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
    !!access.token || !!access.userSession || !!access.adminSession;
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
        timeout: PDF_TIMEOUT_MS,
      });

      await page.waitForSelector(PRINT_READY_SELECTOR, {
        timeout: PDF_TIMEOUT_MS,
      });

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "12mm", right: "15mm", bottom: "12mm", left: "15mm" },
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
