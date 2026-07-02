import type { Browser } from "playwright";

export const PLAYWRIGHT_RENDER_TIMEOUT_MS = 30_000;
export const PRINT_READY_SELECTOR = "html[data-print-ready='true']";

let browserPromise: Promise<Browser> | null = null;

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
