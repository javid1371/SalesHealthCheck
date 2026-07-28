import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import {
  buildConsultationLeadDetailHref,
  buildConsultationListHref,
  consultationQueueQueryString,
  validateConsultationListFilter,
} from "@/modules/consultation/consultation-list.validators";

describe("validateConsultationListFilter", () => {
  it("defaults new additive filters to off", () => {
    const filter = validateConsultationListFilter(new URLSearchParams());

    expect(filter.onlyOverdueFollowUp).toBe(false);
    expect(filter.onlyFollowUpDueToday).toBe(false);
    expect(filter.excludeAssessmentInProgress).toBe(false);
    expect(filter.onlyStaleNew).toBe(false);
    expect(filter.onlyPendingAssignment).toBe(false);
    expect(filter.onlyTeamQueue).toBe(false);
  });

  it("parses onlyTeamQueue as true or 1", () => {
    expect(
      validateConsultationListFilter(
        new URLSearchParams({ onlyTeamQueue: "true" }),
      ).onlyTeamQueue,
    ).toBe(true);
    expect(
      validateConsultationListFilter(
        new URLSearchParams({ onlyTeamQueue: "1" }),
      ).onlyTeamQueue,
    ).toBe(true);
    expect(
      validateConsultationListFilter(
        new URLSearchParams({ onlyTeamQueue: "yes" }),
      ).onlyTeamQueue,
    ).toBe(false);
  });

  it("parses onlyOverdueFollowUp, onlyFollowUpDueToday, onlyStaleNew, and excludeAssessmentInProgress", () => {
    const filter = validateConsultationListFilter(
      new URLSearchParams({
        onlyOverdueFollowUp: "true",
        onlyFollowUpDueToday: "true",
        onlyStaleNew: "true",
        excludeAssessmentInProgress: "true",
      }),
    );

    expect(filter.onlyOverdueFollowUp).toBe(true);
    expect(filter.onlyFollowUpDueToday).toBe(true);
    expect(filter.onlyStaleNew).toBe(true);
    expect(filter.excludeAssessmentInProgress).toBe(true);
  });

  it("ignores non-true values for boolean filters", () => {
    const filter = validateConsultationListFilter(
      new URLSearchParams({
        onlyOverdueFollowUp: "1",
        onlyFollowUpDueToday: "yes",
        onlyStaleNew: "1",
        excludeAssessmentInProgress: "yes",
        onlyPendingAssignment: "false",
      }),
    );

    expect(filter.onlyOverdueFollowUp).toBe(false);
    expect(filter.onlyFollowUpDueToday).toBe(false);
    expect(filter.onlyStaleNew).toBe(false);
    expect(filter.excludeAssessmentInProgress).toBe(false);
    expect(filter.onlyPendingAssignment).toBe(false);
  });

  it("still parses existing KPI deep-link filters", () => {
    const filter = validateConsultationListFilter(
      new URLSearchParams({
        status: "new",
        from: "2026-07-22",
        onlyPendingAssignment: "true",
      }),
    );

    expect(filter.status).toBe("new");
    expect(filter.createdFrom).toEqual(new Date("2026-07-22"));
    expect(filter.onlyPendingAssignment).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(() =>
      validateConsultationListFilter(
        new URLSearchParams({ status: "not-a-status" }),
      ),
    ).toThrow(AppError);
  });

  it("parses lastCallOutcome and onlyNeverCalled filters", () => {
    const withOutcome = validateConsultationListFilter(
      new URLSearchParams({ lastCallOutcome: "no_answer" }),
    );
    expect(withOutcome.lastCallOutcome).toBe("no_answer");
    expect(withOutcome.onlyNeverCalled).toBe(false);

    const neverCalled = validateConsultationListFilter(
      new URLSearchParams({ onlyNeverCalled: "true" }),
    );
    expect(neverCalled.onlyNeverCalled).toBe(true);
  });

  it("rejects invalid lastCallOutcome", () => {
    expect(() =>
      validateConsultationListFilter(
        new URLSearchParams({ lastCallOutcome: "picked_up" }),
      ),
    ).toThrow(AppError);
  });
});

describe("consultation queue query helpers", () => {
  it("strips page, pageSize, and view from the queue query", () => {
    const params = new URLSearchParams({
      onlyOverdueFollowUp: "true",
      status: "new",
      page: "2",
      pageSize: "50",
      view: "kanban",
    });

    expect(consultationQueueQueryString(params)).toBe(
      "onlyOverdueFollowUp=true&status=new",
    );
  });

  it("builds detail and list hrefs with optional queue query", () => {
    expect(buildConsultationLeadDetailHref("lead-1")).toBe(
      "/expert/consultations/lead-1",
    );
    expect(
      buildConsultationLeadDetailHref("lead-1", "onlyOverdueFollowUp=true"),
    ).toBe("/expert/consultations/lead-1?onlyOverdueFollowUp=true");
    expect(buildConsultationListHref()).toBe("/expert/consultations");
    expect(buildConsultationListHref("status=new")).toBe(
      "/expert/consultations?status=new",
    );
  });
});
