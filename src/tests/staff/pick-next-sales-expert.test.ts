import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const groupBy = vi.fn();
const callGroupBy = vi.fn();
const update = vi.fn();
const transaction = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

describe("pickNextSalesExpert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callGroupBy.mockResolvedValue([]);
    transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          staffUser: { findMany, update },
          consultationRequest: { groupBy },
          leadCallLog: { groupBy: callGroupBy },
        }),
    );
    update.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
    }));
  });

  it("picks round-robin expert when under capacity", async () => {
    findMany.mockResolvedValue([
      { id: "expert-a", lastAssignedAt: null, maxDailyCalls: null },
      { id: "expert-b", lastAssignedAt: new Date("2026-01-01"), maxDailyCalls: null },
    ]);
    groupBy.mockResolvedValue([
      { assignedToId: "expert-a", _count: { id: 2 } },
      { assignedToId: "expert-b", _count: { id: 1 } },
    ]);

    const { pickNextSalesExpert, CAPACITY_COUNTED_LEAD_STATUSES } = await import(
      "@/modules/staff/staff.repository"
    );

    const expert = await pickNextSalesExpert({ maxOpenLeadsPerExpert: 30 });

    expect(expert?.id).toBe("expert-a");
    expect(groupBy).toHaveBeenCalledWith({
      by: ["assignedToId"],
      _count: { id: true },
      where: {
        assignedToId: { in: ["expert-a", "expert-b"] },
        status: { in: CAPACITY_COUNTED_LEAD_STATUSES },
      },
    });
    expect(CAPACITY_COUNTED_LEAD_STATUSES).not.toContain(
      "assessment_in_progress",
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignmentPausedAt: null,
        }),
      }),
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: "expert-a" },
      data: { lastAssignedAt: expect.any(Date) },
    });
  });

  it("skips experts at or over maxOpenLeadsPerExpert", async () => {
    findMany.mockResolvedValue([
      { id: "expert-full", lastAssignedAt: null, maxDailyCalls: null },
      {
        id: "expert-free",
        lastAssignedAt: new Date("2026-01-01"),
        maxDailyCalls: null,
      },
    ]);
    groupBy.mockResolvedValue([
      { assignedToId: "expert-full", _count: { id: 2 } },
      { assignedToId: "expert-free", _count: { id: 1 } },
    ]);

    const { pickNextSalesExpert } = await import(
      "@/modules/staff/staff.repository"
    );

    const expert = await pickNextSalesExpert({ maxOpenLeadsPerExpert: 2 });

    expect(expert?.id).toBe("expert-free");
  });

  it("returns null when every eligible expert is at capacity", async () => {
    findMany.mockResolvedValue([
      { id: "expert-a", lastAssignedAt: null, maxDailyCalls: null },
      { id: "expert-b", lastAssignedAt: null, maxDailyCalls: null },
    ]);
    groupBy.mockResolvedValue([
      { assignedToId: "expert-a", _count: { id: 5 } },
      { assignedToId: "expert-b", _count: { id: 5 } },
    ]);

    const { pickNextSalesExpert } = await import(
      "@/modules/staff/staff.repository"
    );

    await expect(
      pickNextSalesExpert({ maxOpenLeadsPerExpert: 5 }),
    ).resolves.toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("prefers hot assignee when eligible and under capacity", async () => {
    findMany.mockResolvedValue([
      { id: "expert-rr", lastAssignedAt: null, maxDailyCalls: null },
      {
        id: "expert-hot",
        lastAssignedAt: new Date("2026-01-01"),
        maxDailyCalls: null,
      },
    ]);
    groupBy.mockResolvedValue([
      { assignedToId: "expert-rr", _count: { id: 0 } },
      { assignedToId: "expert-hot", _count: { id: 1 } },
    ]);

    const { pickNextSalesExpert } = await import(
      "@/modules/staff/staff.repository"
    );

    const expert = await pickNextSalesExpert({
      maxOpenLeadsPerExpert: 30,
      preferStaffId: "expert-hot",
    });

    expect(expert?.id).toBe("expert-hot");
  });

  it("falls back to round-robin when preferred expert is over capacity", async () => {
    findMany.mockResolvedValue([
      { id: "expert-rr", lastAssignedAt: null, maxDailyCalls: null },
      {
        id: "expert-hot",
        lastAssignedAt: new Date("2026-01-01"),
        maxDailyCalls: null,
      },
    ]);
    groupBy.mockResolvedValue([
      { assignedToId: "expert-rr", _count: { id: 0 } },
      { assignedToId: "expert-hot", _count: { id: 3 } },
    ]);

    const { pickNextSalesExpert } = await import(
      "@/modules/staff/staff.repository"
    );

    const expert = await pickNextSalesExpert({
      maxOpenLeadsPerExpert: 3,
      preferStaffId: "expert-hot",
    });

    expect(expert?.id).toBe("expert-rr");
  });

  it("falls back to round-robin when preferred expert is excluded", async () => {
    findMany.mockResolvedValue([
      { id: "expert-rr", lastAssignedAt: null, maxDailyCalls: null },
    ]);
    groupBy.mockResolvedValue([]);

    const { pickNextSalesExpert } = await import(
      "@/modules/staff/staff.repository"
    );

    const expert = await pickNextSalesExpert({
      excludeIds: ["expert-hot"],
      maxOpenLeadsPerExpert: 30,
      preferStaffId: "expert-hot",
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { notIn: ["expert-hot"] },
        }),
      }),
    );
    expect(expert?.id).toBe("expert-rr");
  });

  it("skips experts who reached maxDailyCalls", async () => {
    findMany.mockResolvedValue([
      { id: "expert-full", lastAssignedAt: null, maxDailyCalls: 2 },
      {
        id: "expert-free",
        lastAssignedAt: new Date("2026-01-01"),
        maxDailyCalls: 5,
      },
    ]);
    groupBy.mockResolvedValue([]);
    callGroupBy.mockResolvedValue([
      { staffUserId: "expert-full", _count: { id: 2 } },
      { staffUserId: "expert-free", _count: { id: 1 } },
    ]);

    const { pickNextSalesExpert } = await import(
      "@/modules/staff/staff.repository"
    );

    const expert = await pickNextSalesExpert({ maxOpenLeadsPerExpert: 30 });

    expect(expert?.id).toBe("expert-free");
    expect(callGroupBy).toHaveBeenCalled();
  });

  it("does not apply capacity filter when maxOpen is omitted", async () => {
    findMany.mockResolvedValue([
      { id: "expert-a", lastAssignedAt: null, maxDailyCalls: null },
      {
        id: "expert-b",
        lastAssignedAt: new Date("2026-01-01"),
        maxDailyCalls: null,
      },
    ]);

    const { pickNextSalesExpert } = await import(
      "@/modules/staff/staff.repository"
    );

    const expert = await pickNextSalesExpert();

    expect(groupBy).not.toHaveBeenCalled();
    expect(expert?.id).toBe("expert-a");
  });
});
