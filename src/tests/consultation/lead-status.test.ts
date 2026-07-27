import { describe, expect, it } from "vitest";
import {
  compareLeadsByCallQueuePriority,
  isManualStatusTransitionAllowed,
  LEAD_CALL_QUEUE_PRIORITY,
} from "@/modules/consultation/lead-status";

describe("LEAD_CALL_QUEUE_PRIORITY", () => {
  it("orders consultation request first and in-progress last", () => {
    expect(LEAD_CALL_QUEUE_PRIORITY.new).toBeLessThan(
      LEAD_CALL_QUEUE_PRIORITY.assessment_completed,
    );
    expect(LEAD_CALL_QUEUE_PRIORITY.assessment_completed).toBeLessThan(
      LEAD_CALL_QUEUE_PRIORITY.assessment_incomplete,
    );
    expect(LEAD_CALL_QUEUE_PRIORITY.assessment_incomplete).toBeLessThan(
      LEAD_CALL_QUEUE_PRIORITY.contacted,
    );
    expect(LEAD_CALL_QUEUE_PRIORITY.assessment_in_progress).toBeGreaterThan(
      LEAD_CALL_QUEUE_PRIORITY.closed_lost,
    );
  });
});

describe("compareLeadsByCallQueuePriority", () => {
  it("sorts by status priority then newer createdAt", () => {
    const rows = [
      {
        status: "assessment_in_progress" as const,
        createdAt: new Date("2026-07-01T10:00:00Z"),
      },
      {
        status: "assessment_incomplete" as const,
        createdAt: new Date("2026-07-01T12:00:00Z"),
      },
      {
        status: "new" as const,
        createdAt: new Date("2026-07-01T08:00:00Z"),
      },
      {
        status: "assessment_completed" as const,
        createdAt: new Date("2026-07-01T09:00:00Z"),
      },
      {
        status: "new" as const,
        createdAt: new Date("2026-07-01T11:00:00Z"),
      },
    ];

    const sorted = [...rows].sort(compareLeadsByCallQueuePriority);
    expect(sorted.map((row) => row.status)).toEqual([
      "new",
      "new",
      "assessment_completed",
      "assessment_incomplete",
      "assessment_in_progress",
    ]);
    expect(sorted[0]?.createdAt.toISOString()).toBe("2026-07-01T11:00:00.000Z");
    expect(sorted[1]?.createdAt.toISOString()).toBe("2026-07-01T08:00:00.000Z");
  });
});

describe("isManualStatusTransitionAllowed", () => {
  it("blocks entering assessment_in_progress manually", () => {
    expect(
      isManualStatusTransitionAllowed("new", "assessment_in_progress"),
    ).toBe(false);
    expect(
      isManualStatusTransitionAllowed(
        "assessment_completed",
        "assessment_in_progress",
      ),
    ).toBe(false);
  });

  it("allows leaving assessment_in_progress and other transitions", () => {
    expect(
      isManualStatusTransitionAllowed("assessment_in_progress", "contacted"),
    ).toBe(true);
    expect(
      isManualStatusTransitionAllowed("assessment_in_progress", "new"),
    ).toBe(true);
    expect(isManualStatusTransitionAllowed("new", "contacted")).toBe(true);
    expect(
      isManualStatusTransitionAllowed(
        "assessment_in_progress",
        "assessment_in_progress",
      ),
    ).toBe(true);
  });
});
