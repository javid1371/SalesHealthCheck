import { describe, expect, it } from "vitest";
import {
  computeLeadSlaFlags,
  resolveLeadActionHint,
  slaReasonLabel,
  type LeadSlaFlags,
} from "@/modules/consultation/lead-sla";

const noSla: LeadSlaFlags = {
  staleNew: false,
  overdueFollowUp: false,
  highProbabilityUnassigned: false,
  firstContactSlaBreached: false,
  severity: "none",
};

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
    const flags = computeLeadSlaFlags(
      {
        status: "new",
        createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000),
        nextFollowUpAt: null,
        assignedToId: "expert-1",
        purchaseProbabilityBand: null,
        firstContactedAt: now,
      },
      { staleNewLeadHours: 24, now },
    );

    expect(flags.staleNew).toBe(true);
    expect(flags.firstContactSlaBreached).toBe(false);
    expect(flags.severity).toBe("amber");
    expect(slaReasonLabel(flags)).toBe("لید جدید کهنه");
  });

  it("respects custom staleNewLeadHours threshold", () => {
    const createdAt = new Date(Date.now() - 30 * 60 * 60 * 1000);
    const row = {
      status: "new" as const,
      createdAt,
      nextFollowUpAt: null,
      assignedToId: "expert-1",
      purchaseProbabilityBand: null,
      firstContactedAt: new Date(),
    };

    expect(computeLeadSlaFlags(row, 48).staleNew).toBe(false);
    expect(computeLeadSlaFlags(row, 24).staleNew).toBe(true);
  });

  it("flags high-probability unassigned as amber", () => {
    const flags = computeLeadSlaFlags(
      {
        status: "new",
        createdAt: now,
        nextFollowUpAt: null,
        assignedToId: null,
        purchaseProbabilityBand: "high",
      },
      {
        firstContactSlaMinutesByBand: { high: 60, mid: 120, low: 240 },
        now,
      },
    );

    expect(flags.highProbabilityUnassigned).toBe(true);
    expect(flags.firstContactSlaBreached).toBe(false);
    expect(flags.severity).toBe("amber");
    expect(slaReasonLabel(flags)).toBe("احتمال بالا — بدون تخصیص");
  });

  it("flags first-contact SLA breach by band minutes", () => {
    const flags = computeLeadSlaFlags(
      {
        status: "new",
        createdAt: new Date(now.getTime() - 45 * 60 * 1000),
        nextFollowUpAt: null,
        assignedToId: "expert-1",
        purchaseProbabilityBand: "high",
        firstContactedAt: null,
      },
      {
        staleNewLeadHours: 24,
        firstContactSlaMinutesByBand: { high: 30, mid: 120, low: 240 },
        now,
      },
    );

    expect(flags.firstContactSlaBreached).toBe(true);
    expect(flags.severity).toBe("red");
    expect(slaReasonLabel(flags)).toBe("گذشته از SLA تماس اول");
  });

  it("does not flag first-contact SLA after firstContactedAt", () => {
    const flags = computeLeadSlaFlags(
      {
        status: "contacted",
        createdAt: new Date(now.getTime() - 45 * 60 * 1000),
        nextFollowUpAt: null,
        assignedToId: "expert-1",
        purchaseProbabilityBand: "high",
        firstContactedAt: new Date(now.getTime() - 10 * 60 * 1000),
      },
      {
        firstContactSlaMinutesByBand: { high: 30, mid: 120, low: 240 },
        now,
      },
    );

    expect(flags.firstContactSlaBreached).toBe(false);
  });
});

describe("resolveLeadActionHint", () => {
  // Midday local so "later today" / "tomorrow" stay on clear calendar sides.
  const now = new Date(2026, 5, 2, 12, 0, 0, 0);

  it("prefers SLA reason over other hints", () => {
    const laterToday = new Date(2026, 5, 2, 18, 0, 0, 0);
    const hint = resolveLeadActionHint({
      sla: {
        staleNew: true,
        overdueFollowUp: false,
        highProbabilityUnassigned: false,
        firstContactSlaBreached: false,
        severity: "amber",
      },
      slaReason: "لید جدید کهنه",
      nextFollowUpAtIso: laterToday.toISOString(),
      lastCallOutcomeLabel: "عدم پاسخ",
      status: "new",
      now,
    });

    expect(hint).toEqual({ text: "لید جدید کهنه", severity: "amber" });
  });

  it("returns follow-up today when due later today", () => {
    const laterToday = new Date(2026, 5, 2, 18, 0, 0, 0);
    const hint = resolveLeadActionHint({
      sla: noSla,
      slaReason: null,
      nextFollowUpAtIso: laterToday.toISOString(),
      lastCallOutcomeLabel: "عدم پاسخ",
      status: "contacted",
      now,
    });

    expect(hint).toEqual({ text: "پیگیری امروز", severity: "amber" });
  });

  it("returns overdue follow-up when past and SLA is none", () => {
    const yesterday = new Date(2026, 5, 1, 10, 0, 0, 0);
    const hint = resolveLeadActionHint({
      sla: noSla,
      slaReason: null,
      nextFollowUpAtIso: yesterday.toISOString(),
      lastCallOutcomeLabel: null,
      status: "contacted",
      now,
    });

    expect(hint).toEqual({ text: "پیگیری عقب‌افتاده", severity: "red" });
  });

  it("returns last call label when no SLA or follow-up due", () => {
    const future = new Date(2026, 5, 5, 10, 0, 0, 0);
    const hint = resolveLeadActionHint({
      sla: noSla,
      slaReason: null,
      nextFollowUpAtIso: future.toISOString(),
      lastCallOutcomeLabel: "عدم پاسخ",
      status: "contacted",
      now,
    });

    expect(hint).toEqual({
      text: "آخرین تماس: عدم پاسخ",
      severity: "neutral",
    });
  });

  it("returns ready-for-first-call for new leads", () => {
    const hint = resolveLeadActionHint({
      sla: noSla,
      slaReason: null,
      nextFollowUpAtIso: null,
      lastCallOutcomeLabel: null,
      status: "new",
      now,
    });

    expect(hint).toEqual({ text: "آماده اولین تماس", severity: "neutral" });
  });

  it("returns null when nothing actionable", () => {
    const hint = resolveLeadActionHint({
      sla: noSla,
      slaReason: null,
      nextFollowUpAtIso: null,
      lastCallOutcomeLabel: null,
      status: "contacted",
      now,
    });

    expect(hint).toBeNull();
  });
});
