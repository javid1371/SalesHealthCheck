import { describe, expect, it } from "vitest";
import { computeLeadSlaFlags, slaReasonLabel } from "@/modules/consultation/lead-sla";

describe("computeLeadSlaFlags", () => {
  const now = new Date("2026-06-02T12:00:00Z");

  it("flags overdue follow-up as red", () => {
    const flags = computeLeadSlaFlags({
      status: "contacted",
      createdAt: new Date("2026-06-01T10:00:00Z"),
      nextFollowUpAt: new Date("2026-06-01T10:00:00Z"),
      assignedToId: "expert-1",
      purchaseProbabilityBand: null,
    });

    expect(flags.overdueFollowUp).toBe(true);
    expect(flags.severity).toBe("red");
    expect(slaReasonLabel(flags)).toBe("پیگیری عقب‌افتاده");
  });

  it("flags stale new lead as amber", () => {
    const flags = computeLeadSlaFlags({
      status: "new",
      createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000),
      nextFollowUpAt: null,
      assignedToId: "expert-1",
      purchaseProbabilityBand: null,
    });

    expect(flags.staleNew).toBe(true);
    expect(flags.severity).toBe("amber");
    expect(slaReasonLabel(flags)).toBe("لید جدید کهنه");
  });

  it("flags high-probability unassigned as amber", () => {
    const flags = computeLeadSlaFlags({
      status: "new",
      createdAt: now,
      nextFollowUpAt: null,
      assignedToId: null,
      purchaseProbabilityBand: "high",
    });

    expect(flags.highProbabilityUnassigned).toBe(true);
    expect(flags.severity).toBe("amber");
    expect(slaReasonLabel(flags)).toBe("احتمال بالا — بدون تخصیص");
  });
});
