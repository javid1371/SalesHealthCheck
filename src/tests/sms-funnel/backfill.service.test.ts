import { describe, expect, it } from "vitest";
import {
  isEligibleForBackfillGroup,
  type CandidateRow,
} from "@/modules/sms-funnel/backfill.service";

function baseRow(overrides: Partial<CandidateRow> = {}): CandidateRow {
  return {
    userId: "user-1",
    assessmentSessionId: "assessment-1",
    status: "in_progress",
    phone: "09120000000",
    businessName: "Test Biz",
    scorePercentage: 55,
    hasActiveTargetEnrollment: false,
    isOptedOut: false,
    hasConsultation: false,
    hasReportViewed: false,
    ...overrides,
  };
}

describe("isEligibleForBackfillGroup", () => {
  it("includes in_progress users without active seq_incomplete enrollment", () => {
    expect(isEligibleForBackfillGroup(baseRow(), "in_progress")).toBe(true);
  });

  it("excludes in_progress users with active target enrollment", () => {
    expect(
      isEligibleForBackfillGroup(
        baseRow({ hasActiveTargetEnrollment: true }),
        "in_progress",
      ),
    ).toBe(false);
  });

  it("excludes opted-out users", () => {
    expect(
      isEligibleForBackfillGroup(baseRow({ isOptedOut: true }), "in_progress"),
    ).toBe(false);
  });

  it("includes completed users without consultation", () => {
    expect(
      isEligibleForBackfillGroup(
        baseRow({ status: "completed", scorePercentage: 70 }),
        "completed",
      ),
    ).toBe(true);
  });

  it("excludes completed users with consultation", () => {
    expect(
      isEligibleForBackfillGroup(
        baseRow({ status: "completed", hasConsultation: true }),
        "completed",
      ),
    ).toBe(false);
  });

  it("includes started users without active seq_start enrollment", () => {
    expect(
      isEligibleForBackfillGroup(baseRow({ status: "started" }), "started"),
    ).toBe(true);
  });

  it("excludes started users with active seq_start enrollment", () => {
    expect(
      isEligibleForBackfillGroup(
        baseRow({ status: "started", hasActiveTargetEnrollment: true }),
        "started",
      ),
    ).toBe(false);
  });

  it("includes report_viewed users who completed and viewed report", () => {
    expect(
      isEligibleForBackfillGroup(
        baseRow({
          status: "completed",
          hasReportViewed: true,
        }),
        "report_viewed",
      ),
    ).toBe(true);
  });

  it("excludes report_viewed group when report was not viewed", () => {
    expect(
      isEligibleForBackfillGroup(
        baseRow({ status: "completed", hasReportViewed: false }),
        "report_viewed",
      ),
    ).toBe(false);
  });

  it("excludes report_viewed group when consultation exists", () => {
    expect(
      isEligibleForBackfillGroup(
        baseRow({
          status: "completed",
          hasReportViewed: true,
          hasConsultation: true,
        }),
        "report_viewed",
      ),
    ).toBe(false);
  });
});
