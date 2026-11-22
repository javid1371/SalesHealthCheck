import type { Browser, Page } from "playwright";

export const PLAYWRIGHT_RENDER_TIMEOUT_MS = 30_000;
export const PRINT_READY_SELECTOR = "html[data-print-ready='true']";

let browserPromise: Promise<Browser> | null = null;

/**
 * Prefer an explicit render origin, then loopback. APP_BASE_URL is often a
 * public HTTPS host that Chromium inside Docker cannot hairpin, and
 * `localhost` can resolve to IPv6 while Next listens on IPv4.
 */
export function resolvePlaywrightBaseUrl(envLike: {
  pdfRenderBaseUrl?: string;
  appBaseUrl: string;
}): string {
  return (envLike.pdfRenderBaseUrl || envLike.appBaseUrl).replace(/\/$/, "");
}

/**
 * Next.js keeps connections open (dev HMR, RSC streaming), so `networkidle`
 * often never fires and PDF/chart capture times out. DOM ready + the print
 * marker is enough for hydration to finish.
 */
export async function gotoPrintReadyPage(page: Page, url: string): Promise<void> {
  page.on("pageerror", (error) => {
    console.error("Print/chart page crashed:", error);
  });

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: PLAYWRIGHT_RENDER_TIMEOUT_MS,
  });

  await page.waitForSelector(PRINT_READY_SELECTOR, {
    timeout: PLAYWRIGHT_RENDER_TIMEOUT_MS,
  });
}

// Import Playwright lazily so modules that only *might* generate a PDF/chart
// (e.g. the messenger webhook) don't hard-depend on the `playwright` package
// at load time. Images built without Chromium (INSTALL_PLAYWRIGHT=false) must
// still be able to import these services; the browser is only required once a
// PDF/chart is actually requested.
async function launchBrowser(): Promise<Browser> {
  const { chromium } = await import("playwright");
  return chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((error) => {
      // Don't cache a rejected launch — allow the next request to retry.
      browserPromise = null;
      throw error;
    });
  }
  return browserPromise;
}

export function resetBrowserForTests(): void {
  browserPromise = null;
}
