import { describe, expect, it } from "vitest";
import { resolvePlaywrightBaseUrl } from "@/modules/report/playwright-browser";

describe("resolvePlaywrightBaseUrl", () => {
  it("prefers pdfRenderBaseUrl and strips a trailing slash", () => {
    expect(
      resolvePlaywrightBaseUrl({
        pdfRenderBaseUrl: "http://127.0.0.1:3000/",
        appBaseUrl: "https://health.example.com",
      }),
    ).toBe("http://127.0.0.1:3000");
  });

  it("falls back to appBaseUrl", () => {
    expect(
      resolvePlaywrightBaseUrl({
        appBaseUrl: "http://localhost:3000/",
      }),
    ).toBe("http://localhost:3000");
  });
});
