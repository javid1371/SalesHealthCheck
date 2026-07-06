import { describe, expect, it } from "vitest";
import { findDuplicatePendingIds } from "../../../scripts/cleanup-duplicate-sms-pending";

describe("findDuplicatePendingIds", () => {
  it("returns newer duplicates and keeps the oldest pending per user step", () => {
    const rows = [
      {
        id: "msg-1",
        sequenceKey: "seq_start",
        stepKey: "S1-1",
        createdAt: new Date("2024-01-01T10:00:00Z"),
        enrollment: { userId: "user-1" },
      },
      {
        id: "msg-2",
        sequenceKey: "seq_start",
        stepKey: "S1-1",
        createdAt: new Date("2024-01-02T10:00:00Z"),
        enrollment: { userId: "user-1" },
      },
      {
        id: "msg-3",
        sequenceKey: "seq_start",
        stepKey: "S1-2",
        createdAt: new Date("2024-01-01T11:00:00Z"),
        enrollment: { userId: "user-1" },
      },
    ];

    expect(findDuplicatePendingIds(rows)).toEqual(["msg-2"]);
  });

  it("does not flag unique user-step combinations", () => {
    const rows = [
      {
        id: "msg-1",
        sequenceKey: "seq_start",
        stepKey: "S1-1",
        createdAt: new Date("2024-01-01T10:00:00Z"),
        enrollment: { userId: "user-1" },
      },
      {
        id: "msg-2",
        sequenceKey: "seq_start",
        stepKey: "S1-1",
        createdAt: new Date("2024-01-01T11:00:00Z"),
        enrollment: { userId: "user-2" },
      },
    ];

    expect(findDuplicatePendingIds(rows)).toEqual([]);
  });
});
