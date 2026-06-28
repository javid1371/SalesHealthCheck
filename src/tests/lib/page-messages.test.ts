import { describe, expect, it } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import {
  PAGE_MESSAGES,
  isTokenAccessError,
  resolveApiError,
} from "@/lib/page-messages";

describe("resolveApiError", () => {
  it("maps 403 access denied to token forbidden message", () => {
    const err = new ApiClientError(
      "assessment_access_denied",
      "Invalid or missing access token",
      403,
    );
    expect(resolveApiError(err, PAGE_MESSAGES.notFound.result)).toBe(
      PAGE_MESSAGES.tokenForbidden,
    );
  });

  it("maps 404 to context-specific not found fallback", () => {
    const err = new ApiClientError("report_not_found", "Report not found", 404);
    expect(resolveApiError(err, PAGE_MESSAGES.notFound.report)).toBe(
      PAGE_MESSAGES.notFound.report,
    );
  });

  it("maps network TypeError to network message", () => {
    expect(resolveApiError(new TypeError("Failed to fetch"))).toBe(
      PAGE_MESSAGES.network,
    );
  });

  it("uses server message for other API errors", () => {
    const err = new ApiClientError(
      "ASSESSMENT_INCOMPLETE",
      "لطفاً همه سوالات را پاسخ دهید.",
      400,
    );
    expect(resolveApiError(err)).toBe("لطفاً همه سوالات را پاسخ دهید.");
  });
});

describe("isTokenAccessError", () => {
  it("detects token-related messages", () => {
    expect(isTokenAccessError(PAGE_MESSAGES.tokenMissing)).toBe(true);
    expect(isTokenAccessError(PAGE_MESSAGES.tokenForbidden)).toBe(true);
    expect(isTokenAccessError(PAGE_MESSAGES.network)).toBe(false);
  });
});
