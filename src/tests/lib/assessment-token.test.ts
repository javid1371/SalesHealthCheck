import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_TOKEN_HEADER,
  extractAssessmentToken,
} from "@/lib/assessment-token";

describe("extractAssessmentToken", () => {
  it("reads X-Assessment-Token header", () => {
    const request = new Request("http://localhost/api/assessments/1", {
      headers: { [ASSESSMENT_TOKEN_HEADER]: "header-token" },
    });
    expect(extractAssessmentToken(request)).toBe("header-token");
  });

  it("reads ?token= query when header is absent", () => {
    const request = new Request(
      "http://localhost/api/assessments/1?token=query-token",
    );
    expect(extractAssessmentToken(request)).toBe("query-token");
  });

  it("prefers header over query", () => {
    const request = new Request(
      "http://localhost/api/assessments/1?token=query-token",
      { headers: { [ASSESSMENT_TOKEN_HEADER]: "header-token" } },
    );
    expect(extractAssessmentToken(request)).toBe("header-token");
  });

  it("returns null when neither is present", () => {
    const request = new Request("http://localhost/api/assessments/1");
    expect(extractAssessmentToken(request)).toBeNull();
  });

  it("trims whitespace and ignores empty values", () => {
    const headerRequest = new Request("http://localhost/api/x", {
      headers: { [ASSESSMENT_TOKEN_HEADER]: "  abc  " },
    });
    expect(extractAssessmentToken(headerRequest)).toBe("abc");

    const emptyHeader = new Request(
      "http://localhost/api/x?token=from-query",
      { headers: { [ASSESSMENT_TOKEN_HEADER]: "   " } },
    );
    expect(extractAssessmentToken(emptyHeader)).toBe("from-query");
  });
});
