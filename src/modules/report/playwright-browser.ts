import type { Browser } from "playwright";
import { chromium } from "playwright";

export const PLAYWRIGHT_RENDER_TIMEOUT_MS = 30_000;
export const PRINT_READY_SELECTOR = "html[data-print-ready='true']";

let browserPromise: Promise<Browser> | null = null;

export async function getBrowser(): Promise<Browser> {
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
